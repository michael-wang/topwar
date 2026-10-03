"""QA-only crops, contact sheets and temporal GIFs from actual renderer frames."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageChops

ROOT = Path(__file__).resolve().parent

def panel(source, label, width=390, crop=None):
    image = Image.open(ROOT / source).convert('RGB')
    if crop: image = image.crop(crop)
    image = image.resize((width, round(image.height * width / image.width)))
    result = Image.new('RGB', (width, image.height + 34), '#eef0e8')
    result.paste(image, (0, 34))
    ImageDraw.Draw(result).text((10, 10), label, fill='#294735')
    return result

def sheet(name, entries, width=390, crop=None):
    panels = [panel(source, label, width, crop) for source, label in entries]
    image = Image.new('RGB', (sum(p.width for p in panels), max(p.height for p in panels)), '#eef0e8')
    x = 0
    for p in panels: image.paste(p, (x, 0)); x += p.width
    image.save(ROOT / name)

for key, name, crop in [
    ('opening', 'portrait-before-after.png', None),
    ('empty-beach', 'foreground-before-after.png', None),
    ('right-house', 'right-house-before-after.png', (80, 400, 690, 1300)),
]:
    sheet(name, [(f'baseline-{key}.png', 'R2 baseline'), (f'polish-{key}.png', 'R3')], crop=crop)
sheet('warship-mode-proof.png', [
    ('baseline-warship-defense.png', 'Defense baseline: legacy ship'),
    ('polish-warship-defense.png', 'Defense R3: ship hidden'),
    ('polish-warship-legacy.png', 'Legacy R3: activity retained'),
], crop=(100, 390, 730, 630), width=500)
sheet('foreground-close.png', [('polish-left-cluster.png', 'Screen-left civilian cluster'),
    ('polish-right-cluster.png', 'Screen-right civilian cluster')], crop=(0, 250, 780, 1420))

for role in ['grunt', 'heavy', 'giant']:
    crop = (200, 700, 580, 1080) if role != 'giant' else (140, 300, 640, 980)
    ages = [100, 110, 220, 400] if role != 'giant' else [100, 250, 450, 520, 750, 1200, 2400]
    sheet(f'{role}-death-sequence.png', [(f'polish-{role}-alive.png', f'{role}: alive')] +
        [(f'polish-{role}-death-{age}.png', f'{age} ms') for age in ages], width=260, crop=crop)
    sheet(f'{role}-death-before-after.png', [(f'{phase}-{role}-death-{age}.png', f'{phase}: {age} ms')
        for phase in ['baseline', 'polish'] for age in ([100, 220, 400] if role != 'giant' else [100, 520, 750])], width=240, crop=crop)
    for phase in ['baseline', 'polish']:
        folder = ROOT / f'{phase}-{role}-death-frames'
        frames = [panel(f'{folder.name}/alive.png', f'{phase} {role}: alive', 320, crop)]
        step = 60 if role == 'giant' else 30
        duration = 2400 if role == 'giant' else 480
        frames += [panel(f'{folder.name}/{age}.png', f'{phase} {role}: {age} ms', 320, crop)
            for age in range(0, duration + 1, step)]
        frames[0].save(ROOT / f'{phase}-{role}-death.gif', save_all=True, append_images=frames[1:],
            duration=[180 if role == 'giant' else 90] + [step] * (len(frames) - 2) + [500], loop=0, disposal=2)

baseline = json.loads((ROOT / 'baseline-stats.json').read_text())
polish = json.loads((ROOT / 'polish-stats.json').read_text())
assert not baseline['errors'] and not polish['errors']
metrics = ['drawCalls', 'triangles', 'geometries', 'textures']
comparison = {}
for key in ['opening', 'normal-crowd', 'dense-mixed', 'death-peak']:
    b, p = baseline['stats'][key], polish['stats'][key]
    comparison[key] = {phase: {metric: data[metric] for metric in metrics}
        for phase, data in [('baseline', b), ('r3', p)]}
    comparison[key]['delta'] = {metric: p[metric] - b[metric] for metric in metrics}
    if key == 'death-peak':
        comparison[key]['simultaneousDeaths'] = 24
        comparison[key]['peak'] = {phase: {metric: max(s[metric] for s in data['deathPeak']['samples']) for metric in metrics}
            for phase, data in [('baseline', b), ('r3', p)]}
guards = {}
for key in ['player', 'boss']:
    b = Image.open(ROOT / f'baseline-{key}-guard.png').convert('RGB')
    p = Image.open(ROOT / f'polish-{key}-guard.png').convert('RGB')
    guards[key] = {'pixelIdentical': ImageChops.difference(b, p).getbbox() is None}
    assert guards[key]['pixelIdentical'], key
live = json.loads((ROOT / 'r3-live-sanity.json').read_text())
prod = json.loads((ROOT / 'production-sanity.json').read_text())
assert all(all(item['checks'].values()) for item in live.values())
assert all(item['level'] == item['expected'] and not item['errors'] for item in prod.values())
report = {'viewport': '390x844 CSS, DPR 2', 'fixtures': comparison, 'guards': guards,
    'bundle': json.loads((ROOT / 'bundle-comparison.json').read_text()),
    'liveChecks': {key: value['checks'] for key, value in live.items()}, 'production': prod,
    'limitations': 'SwiftShader counters measure submitted work, not mobile hardware FPS. Death peaks sample 24 simultaneous deaths at 0/60/100/110/150/220/300/390/480 ms.'}
(ROOT / 'performance-comparison.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
