"""Assemble deterministic screenshot comparisons and motion strips; QA only."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

root = Path(__file__).parent
a = json.loads((root / 'phase2a-stats.json').read_text())
b = json.loads((root / 'phase2b-stats.json').read_text())
assert a['errors'] == b['errors'] == []
metrics = {}
for key in a['stats']:
    before = Image.open(root / f'phase2a-{key}.png').convert('RGB')
    after = Image.open(root / f'phase2b-{key}.png').convert('RGB')
    diff = ImageChops.difference(before, after)
    metrics[key] = {'differenceBounds': diff.getbbox(),
                    'changedPixels': sum(p != (0, 0, 0) for p in diff.get_flattened_data()),
                    'delta': {m: b['stats'][key][m] - a['stats'][key][m]
                              for m in ['drawCalls', 'triangles', 'geometries', 'textures']}}
for key in ['world-only', 'giant-guard', 'boss-guard']:
    assert metrics[key]['changedPixels'] == 0
height_a, height_b = a['stats']['idle']['projectedHeight'], b['stats']['idle']['projectedHeight']
assert abs(height_b / height_a - 1) <= .03
(root / 'comparison.json').write_text(json.dumps({'baseline': 'e0946f183f57b6331b9feac161d2edc0f6fa9a66',
    'viewport': a['viewport'], 'devicePixelRatio': 2, 'metrics': metrics,
    'projectedCrownHeight': {'phase2a': height_a, 'phase2b': height_b}}, indent=2))

def panels(images, labels, name):
    width, height = images[0].size
    canvas = Image.new('RGB', (width * len(images), height + 32), 'white')
    draw = ImageDraw.Draw(canvas)
    for i, (im, label) in enumerate(zip(images, labels)):
        canvas.paste(im, (i * width, 32))
        draw.text((i * width + 8, 9), label, fill='black')
    canvas.save(root / name)

for key in ['isolated', 'idle', 'lane', 'two-defenders', 'silhouette']:
    images = [Image.open(root / f'{phase}-{key}.png').convert('RGB') for phase in ['phase2a', 'phase2b']]
    if key == 'isolated':
        images = [im.crop((30, 490, 745, 1320)) for im in images]
    panels(images, ['Phase 2A', 'Phase 2B'], f'comparison-{key}.png')

for phase, data in [('phase2a', a), ('phase2b', b)]:
    for kind in ['lane', 'recoil', 'empowerment']:
        ages = [item['ageMs'] for item in data['motion'][kind]]
        images = [Image.open(root / f'{phase}-{kind}-{age}ms.png').convert('RGB') for age in ages]
        labels = [f'{kind}: {age} ms' for age in ages]
        if kind == 'lane':
            labels = [f'{percent}% / {age} ms' for percent, age in zip([0, 20, 40, 60, 80, 100], ages)]
        panels(images, labels, f'{phase}-{kind}-motion-strip.png')
for kind in ['lane', 'recoil', 'empowerment']:
    before = Image.open(root / f'phase2a-{kind}-motion-strip.png')
    after = Image.open(root / f'phase2b-{kind}-motion-strip.png')
    canvas = Image.new('RGB', (before.width, before.height + after.height + 64), 'white')
    draw = ImageDraw.Draw(canvas)
    draw.text((8, 9), 'Phase 2A', fill='black'); canvas.paste(before, (0, 32))
    draw.text((8, before.height + 41), 'Phase 2B', fill='black'); canvas.paste(after, (0, before.height + 64))
    canvas.save(root / f'comparison-{kind}-motion-strip.png')
print(json.dumps({'idleDelta': metrics['idle']['delta'], 'crownHeight': [height_a, height_b]}, indent=2))
