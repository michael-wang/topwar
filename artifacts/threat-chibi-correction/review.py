from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageChops, ImageFilter
import json
from collections import deque
ROOT=Path(__file__).resolve().parent
FONT=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',20)
SMALL=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',16)
ROLES=['player','grunt','heavy','giant']
def load(name): return Image.open(ROOT/name).convert('RGB')
def sheet(name,rows,columns,tiles,w=330,h=400):
    image=Image.new('RGB',(columns*w,55+len(rows)*h),(243,240,232)); d=ImageDraw.Draw(image)
    d.text((15,16),name.replace('-',' '),font=FONT,fill='#243b4a')
    for y,row in enumerate(rows):
        for x in range(columns):
            label,picture=tiles[y*columns+x]
            picture=picture.copy(); picture.thumbnail((w-12,h-38))
            image.paste(picture,(x*w+(w-picture.width)//2,55+y*h+32))
            d.text((x*w+8,55+y*h+5),label,font=SMALL,fill='#243b4a')
    image.save(ROOT/(name+'.png'))
def close(phase,role,view='front'):
    return load(f'{phase}-{role}-isolated-{view}.png').crop((45,490,745,1300))
sheet('enemy-palette-before-after',['Grunt','Heavy','Giant'],2,
    [(f'{role.title()} {phase}',close(phase,role)) for role in ROLES[1:] for phase in ['baseline','polish']])
sheet('player-vs-enemy-palette',['family'],4,[(r.title(),close('polish',r)) for r in ROLES])
for r in ['heavy','giant']:
    sheet(r+'-form-before-after',['front','rear'],2,
        [(f'{phase} {v}',close(phase,r,v)) for v in ['front','rear'] for phase in ['baseline','polish']])
    sheet(r+('-helmet-comparison' if r=='heavy' else '-upper-body-comparison'),['detail'],2,
        [(phase,close(phase,r).crop((0,0,700,580))) for phase in ['baseline','polish']],400,380)
shoeTiles=[]
for r in ROLES+['boss']:
    for phase in ['baseline','polish']:
        picture=load(f'{phase}-boss-guard.png').crop((275,690,500,820)) if r=='boss' else load(f'{phase}-{r}-isolated-front.png').crop((70,1000,700,1260))
        shoeTiles.append((f'{r.title()} {phase}',picture))
sheet('footwear-before-after',ROLES+['boss'],2,shoeTiles,400,220)
sheet('giant-hp-containment',['full','half','low','zero'],2,
    [(f'{phase} {hp}% HP',load(f'{phase}-giant-hp-{hp}.png').crop((250,290,550,385)))
     for hp in [100,50,10,0] for phase in ['baseline','polish']],420,185)
# Align feet while preserving the common camera's pixel scale, not normalizing role sizes.
def foreground_box(picture, black=False):
    roi=picture.crop((120,180,660,1400))
    mask=Image.new('L',roi.size)
    mask.putdata([255 if (max(pixel)<20 if black else min(pixel)<235) else 0 for pixel in roi.get_flattened_data()])
    box=mask.getbbox()
    return (box[0]+120-15,box[1]+180-15,box[2]+120+15,box[3]+180+15)
def silhouette(role):
    source=load(f'polish-{role}-silhouette.png'); crop=source.crop(foreground_box(source,True))
    canvas=Image.new('RGB',(480,450),'white'); canvas.paste(crop,((480-crop.width)//2,430-crop.height))
    return canvas
sheet('silhouette-sheet',['projection'],4,[(r.title(),silhouette(r)) for r in ROLES],350,390)
for role in ROLES[1:]:
    samples=[0,12.5,25,37.5,50,62.5,75,87.5,100]
    pictures=[load(f'polish-{role}-gait-{t}.png') for t in samples]
    boxes=[foreground_box(p) for p in pictures]
    union=(min(b[0] for b in boxes),min(b[1] for b in boxes),max(b[2] for b in boxes),max(b[3] for b in boxes))
    sheet(role+'-gait-confirmation',['complete cycle'],9,
        [(str(t)+'%',picture.crop(union)) for t,picture in zip(samples,pictures)],180,260)
# World and frozen silhouettes must remain identical; omit only the build stamp.
guards={}
for key in ['world-guard','player-silhouette','grunt-silhouette']:
    a=load('baseline-'+key+'.png').crop((0,0,780,1640)); b=load('polish-'+key+'.png').crop((0,0,780,1640))
    box=ImageChops.difference(a,b).getbbox(); guards[key]={'identical':box is None,'differenceBounds':box}
    if box is not None: raise RuntimeError('Frozen guard changed: '+key)
base=json.loads((ROOT/'baseline-stats.json').read_text(encoding='utf-8'))
after=json.loads((ROOT/'polish-stats.json').read_text(encoding='utf-8'))
metrics={}
for key in ['normal','mixed-threats','mixed-50','mixed-100','mixed-150','mixed-200','giants-two']:
    keys=['drawCalls','triangles','geometries','textures']
    b={k:base['stats'][key][k] for k in keys}; a={k:after['stats'][key][k] for k in keys}
    metrics[key]={'baseline':b,'phase4c':a,'delta':{k:a[k]-b[k] for k in keys}}
    assert a['drawCalls']==b['drawCalls'] and a['textures']==b['textures'] and a['geometries']==b['geometries']
for phase in ['baseline','polish']:
    frames=[load(f'{phase}-sequence/{i:02}.png').resize((390,844)) for i in range(51)]
    frames[0].save(ROOT/(phase+'-running.gif'),save_all=True,append_images=frames[1:],duration=50,loop=0,optimize=False)
    sheet(phase+'-temporal-contact-sheet',['2.5s'],6,
        [(str(i*50)+' ms',frames[i].crop((70,140,320,500))) for i in [0,10,20,30,40,50]],210,320)
b=json.loads((ROOT/'baseline-temporal.json').read_text(encoding='utf-8'))
a=json.loads((ROOT/'polish-temporal.json').read_text(encoding='utf-8'))
assert a['samples']==b['samples'], 'Temporal simulation changed'
# Independent actual-render check: compare coral pixels against the connected
# empty inner track, separated from the outer outline by the ivory border.
# Allow one pixel for the track edge's antialiasing, never beyond the frame.
hpPixels={}
for phase in ['baseline','polish']:
    empty=load(f'{phase}-giant-hp-0.png').crop((250,310,550,365))
    queue=deque([(145,28)]); visited=set(); mask=Image.new('L',empty.size)
    while queue:
        x,y=queue.popleft()
        if (x,y) in visited or not 0<=x<empty.width or not 0<=y<empty.height: continue
        visited.add((x,y))
        if max(empty.getpixel((x,y)))>=100: continue
        mask.putpixel((x,y),255); queue.extend([(x-1,y),(x+1,y),(x,y-1),(x,y+1)])
    mask=mask.filter(ImageFilter.MaxFilter(3)); hpPixels[phase]={}
    for hp in [100,50,10]:
        image=load(f'{phase}-giant-hp-{hp}.png').crop((250,310,550,365)); total=outside=0
        for y in range(image.height):
            for x in range(image.width):
                r,g,b=image.getpixel((x,y))
                if r>140 and r>g*1.6 and r>b*1.5:
                    total+=1; outside+=mask.getpixel((x,y))==0
        hpPixels[phase][hp]={'coralPixels':total,'outsideTrack':outside}
        if phase=='polish': assert total>0 and outside==0, 'HP fill escaped the rendered frame'
report={'hpPixelContainment':hpPixels,'guards':guards,'temporalSimulationIdentical':True,'performance':metrics,'occupancy':{'baseline':base['occupancy'],'phase4c':after['occupancy']},'browserErrors':after['errors']}
(ROOT/'review-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
