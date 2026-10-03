from PIL import Image, ImageChops, ImageDraw
from pathlib import Path
import json
p=Path('artifacts/threat-chibi-prototype')
a=json.loads((p/'baseline-stats.json').read_text(encoding='utf-8'))
b=json.loads((p/'prototype-stats.json').read_text(encoding='utf-8'))
print('Occupancy',b['occupancy'])
for name in ['normal','mixed-threats','mixed-50','mixed-100','mixed-150','mixed-200','giants-two']:
 print(name,{v: [s['stats'][name]['drawCalls'],s['stats'][name]['triangles'],s['stats'][name]['gpu']] for v,s in [('before',a),('after',b)]})
checks={}
for name in ['player-guard','grunt-guard','grunt-hit-guard','grunt-death-guard','grunt-contact-guard','world-guard','boss-guard','boss-death-guard']:
 before=Image.open(p/f'baseline-{name}.png').convert('RGB'); after=Image.open(p/f'prototype-{name}.png').convert('RGB')
 bbox=ImageChops.difference(before,after).getbbox();checks[name]=bbox
print('guards',checks)
(p/'pixel-guards.json').write_text(json.dumps(checks,indent=2),encoding='utf-8')
# Each silhouette/helmet panel retains actual portrait projection size. Crop only whitespace.
for kind in ['silhouette','helmet','helmet-color']:
 sheet=Image.new('RGB',(1400,620),'#f5f5ef');draw=ImageDraw.Draw(sheet)
 for i,role in enumerate(['player','grunt','heavy','giant']):
  im=Image.open(p/f'prototype-{role}-{kind}.png').convert('RGB')
  bounds=b['occupancy'][role]['bounds'];box=(int(bounds['min'][0]*2)-8,int(bounds['min'][1]*2)-8,int(bounds['max'][0]*2)+8,int(bounds['max'][1]*2)+8)
  if box:
   crop=im.crop(box);sheet.paste(crop,(i*350+(350-crop.width)//2,560-crop.height))
  draw.text((i*350+25,590),role.upper(),fill='black')
 sheet.save(p/f'{kind}-sheet.png')
for role in ['heavy','giant']:
 sheet=Image.new('RGB',(6*260,520),'#f5f5ef');draw=ImageDraw.Draw(sheet)
 for i,percent in enumerate([0,20,40,60,80,100]):
  im=Image.open(p/f'prototype-{role}-gait-{percent}.png').convert('RGB')
  crop=im.crop((150,650 if role=='heavy' else 300,650,1100 if role=='heavy' else 850));crop.thumbnail((250,450))
  sheet.paste(crop,(i*260+(260-crop.width)//2,20));draw.text((i*260+20,490),f'{percent}%',fill='black')
 sheet.save(p/f'{role}-gait-strip.png')
for name in ['review-opening','mixed-threats','heavy-isolated-front','giant-isolated-front']:
 imgs=[Image.open(p/f'{phase}-{name}.png').convert('RGB') for phase in ['baseline','prototype']]
 sheet=Image.new('RGB',(imgs[0].width*2,imgs[0].height+40),'white');d=ImageDraw.Draw(sheet)
 for i,im in enumerate(imgs):sheet.paste(im,(i*im.width,40));d.text((i*im.width+20,10),['PHASE 3B','PHASE 4A'][i],fill='black')
 sheet.save(p/f'compare-{name}.png')
assert all(v is None for v in checks.values()),checks
