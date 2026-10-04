"""QA-only sheets, temporal media, pixel guards and performance comparison."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parent

def panel(source, label, width=390, crop=None):
    image = Image.open(ROOT/source).convert('RGB')
    if crop: image = image.crop(crop)
    image = image.resize((width, round(image.height*width/image.width)))
    result = Image.new('RGB', (width, image.height+36), '#eef0e8')
    result.paste(image, (0,36)); ImageDraw.Draw(result).text((10,11), label, fill='#294735')
    return result

def sheet(name, entries, width=390, crop=None):
    panels = [panel(source,label,width,crop) for source,label in entries]
    result = Image.new('RGB', (sum(p.width for p in panels),max(p.height for p in panels)), '#eef0e8')
    x=0
    for p in panels: result.paste(p,(x,0)); x+=p.width
    result.save(ROOT/name)

baseline=json.loads((ROOT/'baseline-stats.json').read_text())
final=json.loads((ROOT/'final-stats.json').read_text())
assert not baseline['errors'] and not final['errors']
for key in ['opening','same-depth','review-depth']:
    sheet(f'{key}-before-after.png', [(f'baseline-{key}.png','R4: scale 3.6'),(f'final-{key}.png','R5: scale 1.9')])
sheet('giant-silhouette-before-after.png', [(f'{phase}-giant-silhouette.png',label) for phase,label in [('baseline','R4'),('final','R5')]],crop=(120,300,730,1280))
sheet('giant-hp-states.png', [(f'final-hp-{v}.png',f'HP {v}: dedicated 6:1 bar') for v in [1,0.5,0.1,0]],width=300,crop=(220,460,510,590))
guides=[]
for phase,data in [('baseline',baseline),('final',final)]:
    image=Image.open(ROOT/f'{phase}-giant-proportions.png').convert('RGB');draw=ImageDraw.Draw(image)
    for key,color in [('crown','#387f9d'),('headBottom','#387f9d'),('torsoTop','#aa8b5c'),('ground','#496954')]:
        y=round(data['forms']['giant']['guides'][key]['y']*2)
        draw.line((140,y,690,y),fill=color,width=3);draw.text((12,y+5),key,fill=color)
    name=f'{phase}-proportion-guide.png';image.save(ROOT/name)
    guides.append((name,f"{phase}: {data['forms']['giant']['headZones']:.3f} head zones"))
sheet('giant-proportion-guides.png',guides,crop=(0,300,780,1300))
sheet('giant-gait-strip.png',[(f'final-gait-{i}.png',f'{i*850/8:.0f} ms') for i in range(8)],width=250,crop=(70,400,740,1330))
sheet('weapon-grip-four-poses.png',[(f'final-gait-{i}.png',f'Run pose {i//2+1}') for i in [0,2,4,6]],width=350,crop=(515,695,735,1055))
sheet('weapon-fall-coupling.png',[(f'final-giant-death-{age}.png',f'Fall {age} ms') for age in [0,100,250,450]],width=300,crop=(80,460,720,1300))
for role in ['grunt','heavy']:
    samples=[('alive','Alive'),('death-60','Pale: 60 ms'),('death-110','Shatter: 110 ms'),('death-260','Airborne: 260 ms'),('death-440','Landing: 440 ms'),('death-560','Rest: 560 ms'),('death-710','Rest: 710 ms'),('death-frames/0980','Late fade: 980 ms'),('death-1010','Cleared: 1010 ms')]
    sheet(f'{role}-death-timeline.png',[(f'final-{role}-{suffix}.png',label) for suffix,label in samples],width=240,crop=(160,740,650,1280))
    sheet(f'{role}-rest-before-after.png',[(f'baseline-{role}-death-560.png','R4: already gone'),(f'final-{role}-death-560.png','R5: debris resting')],crop=(140,750,700,1290))
    panel(f'final-{role}-resting-close.png',f'{role}: full-size pale debris on sand',crop=(60,500,720,1250)).save(ROOT/f'{role}-rest-close.png')
sheet('giant-crash-grounding.png',[(f'final-giant-death-{age}.png',f'{age} ms after lethal') for age in [450,520,750,1000,1400,1800]],width=270,crop=(80,670,730,1340))
sheet('dense-resting-debris.png',[(f'final-deaths-{count}-560.png',f'{count} Heavy deaths: {count*8} grounded pieces') for count in [24,48]])

for role in ['grunt','heavy','giant','running']:
    folder=ROOT/(f'final-{role}-death-frames' if role!='running' else 'final-running-frames')
    paths=sorted(folder.glob('*.png'))
    frames=[Image.open(p).convert('RGB').resize((390,844)) for p in paths]
    duration=34 if role=='running' else 80 if role=='giant' else 35
    frames[0].save(ROOT/f'{role}-temporal.gif',save_all=True,append_images=frames[1:],duration=duration,loop=0)
    if role=='running':
        indices=list(range(0,len(paths),6))
        sheet('running-contact-sheet.png',[(str(paths[i].relative_to(ROOT)),f'{i*34} ms') for i in indices],width=220,crop=(170,520,690,900))

metrics=['drawCalls','triangles','geometries','textures','shatterInstances']
performance={}
for key in ['normal-crowd','mixed-threats','giants-two']:
    before,after=baseline['stats'][key],final['stats'][key]
    performance[key]={'r4':{m:before[m] for m in metrics},'r5':{m:after[m] for m in metrics},'delta':{m:after[m]-before[m] for m in metrics}}
for count in [24,48]:
    key=f'deaths-{count}';before,after=baseline['stats'][key],final['stats'][key]
    performance[key]={'r4':{m:before[m] for m in ['peakDraws','peakTriangles','peakShatter']},'r5':{m:after[m] for m in ['peakDraws','peakTriangles','peakShatter']},'samples':after['samples']}
guards={}
for key in ['player','grunt','heavy','world-hud']:
    before=Image.open(ROOT/f'baseline-{key}-guard.png').convert('RGB')
    after=Image.open(ROOT/f'final-{key}-guard.png').convert('RGB')
    bounds=ImageChops.difference(before,after).getbbox()
    guards[key]={'pixelIdentical':bounds is None,'differenceBounds':bounds}
    assert bounds is None,(key,bounds)
landings={}
for role,samples in final['landingStats'].items():
    times=[p['landingMs'] for p in samples]
    landings[role]={'minimumMs':min(times),'maximumMs':max(times),'meanMs':sum(times)/len(times),'fullOpacityRestRangeMs':[720-max(times),720-min(times)]}
live=json.loads((ROOT/'r5-live-sanity.json').read_text())
assert all(all(item['checks'].values()) for item in live.values())
production=json.loads((ROOT/'production-sanity.json').read_text())
assert all(item['level']==item['expected'] and not item['errors'] for item in production.values())
report={'performance':performance,'bundle':json.loads((ROOT/'bundle-comparison.json').read_text()),'guards':guards,'landing':landings,'measurements':final['measurements'],'form':final['forms'],'live':{key:item['checks'] for key,item in live.items()},'production':production}
(ROOT/'performance-review.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({key:report[key] for key in ['performance','guards','landing','measurements']},indent=2))
