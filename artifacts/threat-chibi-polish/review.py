from PIL import Image, ImageChops, ImageDraw
from pathlib import Path
import json
p=Path('artifacts/threat-chibi-polish')
a=json.loads((p/'baseline-stats.json').read_text(encoding='utf-8')); b=json.loads((p/'polish-stats.json').read_text(encoding='utf-8'))
checks={}
# Exclude the changing build SHA footer; all battlefield and HUD pixels remain tested.
for name in ['player-guard','world-guard','boss-guard','boss-death-guard','grunt-death-guard','grunt-contact-guard','grunt-silhouette','grunt-helmet-color','player-silhouette','player-helmet-color']:
 ims=[Image.open(p/f'{phase}-{name}.png').convert('RGB').crop((0,0,780,1640)) for phase in ['baseline','polish']]
 checks[name]=ImageChops.difference(*ims).getbbox()
(p/'pixel-guards.json').write_text(json.dumps({'excluded':'bottom build SHA footer only, below pixel Y=1640','comparisons':checks},indent=2),encoding='utf-8')
assert all(v is None for v in checks.values()), checks
for phase in ['baseline','polish']:
 for kind in ['silhouette','helmet-color']:
  sheet=Image.new('RGB',(1400,620),'#f5f5ef');d=ImageDraw.Draw(sheet)
  for i,role in enumerate(['player','grunt','heavy','giant']):
   bounds=(a if phase=='baseline' else b)['occupancy'][role]['bounds'];box=(int(bounds['min'][0]*2)-8,int(bounds['min'][1]*2)-8,int(bounds['max'][0]*2)+8,int(bounds['max'][1]*2)+8)
   im=Image.open(p/f'{phase}-{role}-{kind}.png').convert('RGB').crop(box);sheet.paste(im,(i*350+(350-im.width)//2,560-im.height));d.text((i*350+25,590),role.upper(),fill='black')
  sheet.save(p/f'{phase}-{kind}-sheet.png')
 frames=[Image.open(f).convert('RGB').crop((0,240,780,1280)) for f in sorted((p/f'{phase}-sequence').glob('*.png'))]
 # Animated evidence plays 2.55s at 20fps, using ordinary simulation/frame code.
 frames[0].save(p/f'{phase}-running.gif',save_all=True,append_images=frames[1:],duration=50,loop=0,optimize=True)
for role in ['grunt','heavy','giant']:
 sheet=Image.new('RGB',(2700,840),'#f5f5ef');d=ImageDraw.Draw(sheet)
 for j,phase in enumerate(['baseline','polish']):
  for i,t in enumerate([0,12.5,25,37.5,50,62.5,75,87.5,100]):
   im=Image.open(p/f'{phase}-{role}-gait-{t}.png').convert('RGB')
   box=(150,300,650,850) if role=='giant' else (150,650,650,1100)
   crop=im.crop(box);crop.thumbnail((290,370));sheet.paste(crop,(i*300+(300-crop.width)//2,j*420+15));d.text((i*300+20,j*420+390),f'{phase} {t}%',fill='black')
 sheet.save(p/f'compare-{role}-gait.png')
for name in ['heavy-silhouette','review-opening','heavy-isolated-front','heavy-isolated-rear','giant-isolated-front','giant-isolated-rear']:
 ims=[Image.open(p/f'{phase}-{name}.png').convert('RGB')for phase in ['baseline','polish']]
 sheet=Image.new('RGB',(1560,1728),'white');d=ImageDraw.Draw(sheet)
 for i,im in enumerate(ims):sheet.paste(im,(i*780,40));d.text((i*780+20,10),['PHASE 4A','PHASE 4B'][i],fill='black')
 sheet.save(p/f'compare-{name}.png')
print('Pixel guards passed:', len(checks))
