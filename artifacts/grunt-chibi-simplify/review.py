"""Assemble review panels and verify untouched role guards. QA only."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw

root = Path(__file__).parent
a = json.loads((root / 'baseline-stats.json').read_text())
b = json.loads((root / 'prototype-stats.json').read_text())
assert a['errors'] == b['errors'] == []
assert a['characterDownloads'] == b['characterDownloads']
assert abs(b['occupancy']['height'] / a['occupancy']['height'] - 1) <= .05
assert b['occupancy']['idleWidth'] <= a['occupancy']['idleWidth'] * 1.1
metrics = {}
for key in a['stats']:
    before = Image.open(root / f'baseline-{key}.png').convert('RGB')
    after = Image.open(root / f'prototype-{key}.png').convert('RGB')
    diff = ImageChops.difference(before, after)
    metrics[key] = {'differenceBounds': diff.getbbox(),
                    'changedPixels': sum(p != (0, 0, 0) for p in diff.get_flattened_data()),
                    'delta': {m: b['stats'][key][m] - a['stats'][key][m]
                              for m in ['drawCalls', 'triangles', 'geometries', 'textures']}}
    if key.endswith('guard'):
        assert metrics[key]['changedPixels'] == 0, key

helmet_diff = ImageChops.difference(Image.open(root / 'baseline-helmet-only.png').convert('RGB'),
                                   Image.open(root / 'prototype-helmet-only.png').convert('RGB'))
assert helmet_diff.getbbox() is None, 'Helmet shape/projection must stay unchanged'

performance = {}
for key in ['normal', 'mixed-heavy', 'crowd-50', 'crowd-100', 'crowd-150', 'crowd-200']:
    fields = ['drawCalls', 'triangles', 'geometries', 'textures']
    if key.startswith('crowd'):
        fields.append('cpuUpdateMedianMs')
    performance[key] = {phase: {m: data['stats'][key][m] for m in fields}
                        for phase, data in [('baseline', a), ('prototype', b)]}
performance['characterDownloads'] = {'baseline': a['characterDownloads'], 'prototype': b['characterDownloads']}
performance['bundles'] = json.loads((root / 'bundle-comparison.json').read_text())
performance['measurement'] = {'viewport': a['viewport'], 'baselineCommit': a['baseline'],
    'geometryTextureCounts': 'WebGL uploaded/cache counts at the same point in the identical QA sequence; feedback history is retained.',
    'cpu': 'Median of 7 warmed trials, 100 EnemyRenderer.update calls each. Chrome desktop software renderer, not phone FPS.'}
(root / 'performance.json').write_text(json.dumps(performance, indent=2))
(root / 'comparison.json').write_text(json.dumps({'baseline': a['baseline'], 'metrics': metrics,
    'occupancy': {'baseline': a['occupancy'], 'prototype': b['occupancy']}}, indent=2))

def panels(images, labels, name):
    width, height = images[0].size
    canvas = Image.new('RGB', (width * len(images), height + 32), 'white')
    draw = ImageDraw.Draw(canvas)
    for i, (im, label) in enumerate(zip(images, labels)):
        canvas.paste(im, (i * width, 32))
        draw.text((i * width + 8, 9), label, fill='black')
    canvas.save(root / name)

for key in ['normal', 'mixed-heavy', 'outer-lane', 'near-contact', 'silhouette', 'isolated-front', 'isolated-rear', 'player-grunt-colors']:
    images = [Image.open(root / f'{phase}-{key}.png').convert('RGB') for phase in ['baseline', 'prototype']]
    if key.startswith('isolated'):
        images = [im.crop((45, 500, 745, 1400)) for im in images]
    if key == 'silhouette':
        images = [im.crop((260, 800, 520, 1040)) for im in images]
    if key == 'player-grunt-colors':
        images = [im.crop((275, 855, 505, 1010)).resize((690, 465), Image.Resampling.NEAREST) for im in images]
    panels(images, ['Phase 3A prototype', 'Phase 3B simplified'], f'comparison-{key}.png')

for phase in ['baseline', 'prototype']:
    ages = [0, 60, 120, 180, 240, 300, 360]
    frames = [Image.open(root / f'{phase}-gait-{age}ms.png').convert('RGB').crop((280, 805, 500, 1030)) for age in ages]
    panels(frames, [f'{age} ms' for age in ages], f'{phase}-gait-motion-strip.png')
    for key in ['player-grunt-silhouettes', 'helmet-only']:
        im = Image.open(root / f'{phase}-{key}.png').convert('RGB').crop((275, 855, 505, 1010))
        # Full portraits retain actual scale; nearest enlargement helps inspection.
        panels([im.resize((690, 465), Image.Resampling.NEAREST)], ['Grunt left / Player right: 3x pixel inspection'], f'{phase}-{key}-crop.png')

front = Image.open(root / 'prototype-isolated-front.png').convert('RGB').crop((130, 1060, 635, 1250))
front.save(root / 'prototype-clothing-close.png')
body_details = [Image.open(root / f'{phase}-isolated-front.png').convert('RGB').crop((90, 925, 695, 1355))
                for phase in ['baseline', 'prototype']]
panels(body_details, ['Phase 3A: layered bare/camo body', 'Phase 3B: one rounded shirt/shorts body'], 'comparison-body-detail.png')
print(json.dumps({'occupancy': [a['occupancy'], b['occupancy']], 'mixed': performance['mixed-heavy'],
                  'untouchedGuards': sum(key.endswith('guard') for key in metrics)}, indent=2))
