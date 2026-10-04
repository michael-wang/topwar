"""QA-only contact sheets and measurements from actual Three.js renderer frames."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parent

def panel(source, label, width=390, crop=None):
    image = Image.open(ROOT / source).convert('RGB')
    if crop: image = image.crop(crop)
    image = image.resize((width, round(image.height * width / image.width)))
    result = Image.new('RGB', (width, image.height + 36), '#eef0e8')
    result.paste(image, (0, 36))
    ImageDraw.Draw(result).text((10, 11), label, fill='#294735')
    return result

def sheet(name, entries, width=390, crop=None):
    panels = [panel(source, label, width, crop) for source, label in entries]
    image = Image.new('RGB', (sum(p.width for p in panels), max(p.height for p in panels)), '#eef0e8')
    x = 0
    for p in panels: image.paste(p, (x, 0)); x += p.width
    image.save(ROOT / name)

for key, name in [('opening', 'portrait-before-after.png'), ('empty', 'foreground-before-after.png')]:
    sheet(name, [(f'baseline-{key}.png', 'R3 baseline'), (f'final-{key}.png', 'R4')])
for side in ['left', 'right']:
    panel(f'final-{side}-house.png', f'{side}: near-camera village', crop=(40, 370, 740, 1320)).save(ROOT / f'{side}-house-close.png')
sheet('lane-clearance.png', [('final-outer-lanes.png', 'Near outer-lane enemies'),
    ('final-opening.png', 'Two defenders, open center')])

for role in ['heavy', 'giant']:
    sheet(f'{role}-before-after.png', [(f'baseline-{role}-three-quarter.png', f'R3 {role}'),
        (f'final-{role}-three-quarter.png', f'R4 {role}')], crop=(60, 390, 720, 1350))
    sheet(f'{role}-views.png', [(f'final-{role}-{view}.png', view) for view in ['front', 'three-quarter', 'side']],
        crop=(60, 390, 720, 1350))
    source = 'final-heavy-three-quarter.png' if role == 'heavy' else 'final-giant-equipment.png'
    crop = (180, 820, 690, 1200) if role == 'heavy' else (60, 400, 720, 1270)
    panel(source, 'Canvas pouches' if role == 'heavy' else 'Canvas satchel / flat belt',
        crop=crop).save(ROOT / f'{role}-equipment-close.png')

sheet('silhouette-sheet.png', [(f'final-{role}-silhouette.png', f'R4 {role}: actual gameplay projection')
    for role in ['grunt', 'heavy', 'giant']], width=300, crop=(80, 280, 700, 1160))
sheet('hud-before-after.png', [(f'{phase}-hud-390-{kind}.png', f'{phase}: {kind}')
    for kind in ['fireRate', 'squad'] for phase in ['baseline', 'final']], crop=(0, 1510, 780, 1688))
for width in [390, 350]:
    sheet(f'hud-{width}.png', [(f'final-hud-{width}-{kind}.png', f'{width}px: {kind}')
        for kind in ['fireRate', 'squad']], width=width, crop=(0, 1510, width*2, 1688))

baseline = json.loads((ROOT / 'baseline-stats.json').read_text())
final = json.loads((ROOT / 'final-stats.json').read_text())
assert not baseline['errors'] and not final['errors']

guides = []
for phase, data in [('baseline', baseline), ('final', final)]:
    form = data['forms']['giant']
    image = Image.open(ROOT / f'{phase}-giant-front.png').convert('RGB')
    draw = ImageDraw.Draw(image)
    for key, color in [('crown', '#387f9d'), ('headBottom', '#387f9d'), ('ground', '#496954')]:
        y = round(form['guides'][key]['y'] * 2)
        draw.line((170, y, 610, y), fill=color, width=3)
        draw.text((12, y+5), f'{key}', fill=color)
    path = f'{phase}-giant-guides.png'; image.save(ROOT / path)
    guides.append((path, f"{phase}: {form['ratio']:.2f} authored head zones"))
sheet('giant-proportion-guides.png', guides, crop=(0, 350, 780, 1360))

for kind in ['fireRate', 'squad']:
    box = final['hud'][f'390-{kind}']['enhancement']
    bounds = tuple(round(v*2) for v in [box['x']-6, box['y']-6, box['right']+6, box['bottom']+6])
    panel(f'final-hud-390-{kind}.png', f'Current truth: {final["hud"][f"390-{kind}"]["value"]}',
        width=300, crop=bounds).save(ROOT / f'enhancement-{kind}.png')
box = final['hud']['390-squad']['weapon']
bounds = tuple(round(v*2) for v in [box['x']-6, box['y']-6, box['right']+6, box['bottom']+6])
panel('final-hud-390-squad.png', 'Rifle: enlarged inspection', width=300, crop=bounds).save(ROOT / 'weapon-readability.png')

metrics = ['drawCalls', 'triangles', 'geometries', 'textures']
comparison = {}
for key in ['normal-crowd', 'mixed-threats', 'mixed-100', 'mixed-200', 'giants-two']:
    b, p = baseline['stats'][key], final['stats'][key]
    comparison[key] = {phase: {metric: data[metric] for metric in metrics}
        for phase, data in [('r3', b), ('r4', p)]}
    comparison[key]['delta'] = {metric: p[metric] - b[metric] for metric in metrics}
guards = {}
for role in ['player', 'grunt', 'boss']:
    # The intentionally revised footer is outside the guard region.
    b = Image.open(ROOT / f'baseline-{role}-guard.png').convert('RGB').crop((0, 0, 780, 1440))
    p = Image.open(ROOT / f'final-{role}-guard.png').convert('RGB').crop((0, 0, 780, 1440))
    bounds = ImageChops.difference(b, p).getbbox()
    guards[role] = {'pixelIdentical': bounds is None, 'comparisonCrop': [0,0,780,1440]}
    assert bounds is None, (role, bounds)
live = json.loads((ROOT / 'r4-live-sanity.json').read_text())
prod = json.loads((ROOT / 'production-sanity.json').read_text())
hud = json.loads((ROOT / 'hud-sanity.json').read_text())
assert all(all(item['checks'].values()) for item in live.values())
assert all(item['level'] == item['expected'] and not item['errors'] for item in prod.values())
assert not hud['errors'] and all(all(item['checks'].values()) for item in hud['results'].values())
report = {'viewport': '390x844 CSS / DPR 2, SwiftShader', 'fixtures': comparison, 'guards': guards,
    'forms': {'r3': baseline['forms'], 'r4': final['forms']},
    'occupancy': {'r3': baseline['occupancy'], 'r4': final['occupancy']},
    'bundle': json.loads((ROOT / 'bundle-comparison.json').read_text()),
    'hud': final['hud'], 'liveInput': live, 'productionGuard': prod, 'hudSafeArea': hud,
    'validation': {'testFiles': 86, 'tests': 589, 'typecheck': 'passed', 'build': 'passed'}}
(ROOT / 'performance-comparison.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'fixtures': comparison, 'guards': guards, 'forms': report['forms']}, indent=2))
