from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops
import json
ROOT=Path(__file__).resolve().parent
ROLES=['player','grunt','heavy','giant']
FONT=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20)
SMALL=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)

def load(name): return Image.open(ROOT/name).convert('RGB')
def sheet(name,tiles,columns,w=400,h=460):
    rows=(len(tiles)+columns-1)//columns
    out=Image.new('RGB',(columns*w,55+rows*h),(243,240,232)); d=ImageDraw.Draw(out)
    d.text((15,16),name.replace('-',' '),font=FONT,fill='#243b4a')
    for i,(label,picture) in enumerate(tiles):
        x=i%columns*w; y=55+i//columns*h
        picture=picture.copy(); picture.thumbnail((w-16,h-40))
        out.paste(picture,(x+(w-picture.width)//2,y+34))
        d.text((x+8,y+6),label,font=SMALL,fill='#243b4a')
    out.save(ROOT/(name+'.png'))

def close(phase,role,view='front'):
    return load(f'{phase}-{role}-isolated-{view}.png').crop((0,490,780,1300))
def figure(picture,black=False):
    bg=picture.getpixel((0,0)); mask=Image.new('L',picture.size)
    mask.putdata([255 if (max(p)<40 if black else max(abs(a-b) for a,b in zip(p,bg))>12) else 0
        for p in picture.get_flattened_data()])
    return picture.crop(mask.getbbox())
def silhouette(phase,role):
    return figure(load(f'{phase}-{role}-silhouette.png').crop((120,180,660,1400)),True)

sheet('r1-to-r2-four-role-beauty-sheet',[(f'{r.title()} {label}',close(p,r))
    for p,label in [('baseline','R1'),('polish','R2')] for r in ROLES],4,430,520)
sheet('r2-four-role-beauty-sheet',[(r.title(),close('polish',r)) for r in ROLES],4,430,520)
for r in ['grunt','heavy','giant']:
    sheet(r+'-equipment-close',[(view,load(f'polish-{r}-isolated-{view}.png').crop((0,850,780,1290)))
        for view in ['front','rear']],2,500,380)
sheet('trousers-footwear-relationship',[(r.title(),load(f'polish-{r}-isolated-front.png').crop((0,930,780,1260)))
    for r in ROLES],4,430,300)

normalized={}
for black in [False,True]:
    tiles=[]
    for r in ['grunt','heavy']:
        p=silhouette('polish',r) if black else figure(close('polish',r))
        p=p.resize((round(p.width*320/p.height),320),Image.Resampling.LANCZOS)
        normalized[r]={'heightPixels':p.height,'widthPixels':p.width}
        tiles.append((r.title()+' — same 320 px height',p))
    sheet('grunt-heavy-normalized-'+('silhouettes' if black else 'height'),tiles,2,560,390)

# Retain gameplay pixel scale in the full-family silhouette sheet.
tiles=[]
for r in ROLES:
    p=silhouette('polish',r); canvas=Image.new('RGB',(480,440),'white')
    canvas.paste(p,((480-p.width)//2,425-p.height)); tiles.append((r.title(),canvas))
sheet('actual-projection-silhouette-sheet',tiles,4,350,390)

def gait(role,samples):
    pictures=[load(f'polish-{role}-gait-{t}.png') for t in samples]
    boxes=[]
    for p in pictures:
        roi=p.crop((120,180,660,1400)); mask=Image.new('L',roi.size)
        mask.putdata([255 if min(pixel)<235 else 0 for pixel in roi.get_flattened_data()])
        b=mask.getbbox(); boxes.append((b[0]+110,b[1]+170,b[2]+130,b[3]+190))
    union=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
    sheet(role+'-gait-strip',[(str(t),p.crop(union)) for t,p in zip(samples,pictures)],len(samples),180,280)
for r in ROLES[1:]: gait(r,[0,12.5,25,37.5,50,62.5,75,87.5,100])
gait('player',[0,44,88,132,176,220])

guards={}
for key in ['world-guard','boss-guard','boss-death-guard']:
    a=load('baseline-'+key+'.png').crop((0,0,780,1640)); b=load('polish-'+key+'.png').crop((0,0,780,1640))
    difference=ImageChops.difference(a,b); box=difference.getbbox()
    maximum=max(v[1] for v in difference.getextrema())
    guards[key]={'identical':box is None,'differenceBounds':box,'maxChannelDelta':maximum,
      'changedPixels':sum(max(v)>0 for v in difference.get_flattened_data())}
    # SwiftShader Boss texture/UI captures can differ by one quantization step.
    # World must be exact; all frozen legacy-asset tests remain unchanged.
    assert maximum <= (1 if key=='boss-guard' else 0),'Frozen guard changed: '+key
for hp in [100,50,10,0]:
    a=load(f'baseline-giant-hp-{hp}.png').crop((250,310,550,365))
    b=load(f'polish-giant-hp-{hp}.png').crop((250,310,550,365))
    assert ImageChops.difference(a,b).getbbox() is None,'R1 HP bar changed'
guards['r1-giant-hp']={'identical':True}

base=json.loads((ROOT/'baseline-stats.json').read_text(encoding='utf-8'))
after=json.loads((ROOT/'polish-stats.json').read_text(encoding='utf-8'))
metrics={}
for key in ['normal','mixed-threats','mixed-50','mixed-100','mixed-150','mixed-200','giants-two']:
    keys=['drawCalls','triangles','geometries','textures']
    b={k:base['stats'][key][k] for k in keys}; a={k:after['stats'][key][k] for k in keys}
    increase=(a['triangles']/b['triangles']-1)*100
    metrics[key]={'r1':b,'r2':a,'delta':{k:a[k]-b[k] for k in keys},'triangleIncreasePercent':increase,'exceeds15Percent':increase>15}
    assert a['drawCalls']==b['drawCalls'] and a['textures']==b['textures'] and a['geometries']==b['geometries']
report={'performance':metrics,'normalizedHeight':normalized,'guards':guards,'browserErrors':after['errors']}
if (ROOT/'bundle-comparison.json').exists(): report['bundle']=json.loads((ROOT/'bundle-comparison.json').read_text(encoding='utf-8'))
(ROOT/'performance.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
if (ROOT/'polish-giant-hit-peak.png').exists():
    sheet('giant-hit-comparison',[(label,load(f'{phase}-giant-hit-{state}.png').crop((230,370,500,760)))
      for phase,state,label in [('baseline','peak','R1 peak'),('polish','peak','R2 peak'),('polish','50','R2 50 ms'),('polish','settled','R2 settled')]],4,340,490)
if (ROOT/'polish-temporal.json').exists():
    b=json.loads((ROOT/'baseline-temporal.json').read_text(encoding='utf-8'))
    a=json.loads((ROOT/'polish-temporal.json').read_text(encoding='utf-8'))
    assert a['samples']==b['samples'],'Temporal simulation changed'
    assert not a['errors'] and not b['errors']
    report['temporalSimulationIdentical']=True
    for phase in ['baseline','polish']:
        frames=[load(f'{phase}-sequence/{i:02}.png').resize((390,844)) for i in range(51)]
        frames[0].save(ROOT/(phase+'-running.gif'),save_all=True,append_images=frames[1:],duration=50,loop=0,optimize=False)
        sheet(phase+'-temporal-contact-sheet',[(str(i*50)+' ms',frames[i].crop((70,140,320,500)))
            for i in [0,10,20,30,40,50]],6,210,320)
    (ROOT/'performance.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
