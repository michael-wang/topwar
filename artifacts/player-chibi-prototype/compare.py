"""Pixel bounds and renderer counters from matching deterministic portraits."""
import json
from pathlib import Path
from PIL import Image, ImageChops

root = Path(__file__).parent
before = json.loads((root / 'baseline-stats.json').read_text())
after = json.loads((root / 'prototype-stats.json').read_text())
comparisons = {}
for key in before['stats']:
    a = Image.open(root / f'baseline-{key}.png').convert('RGB')
    b = Image.open(root / f'prototype-{key}.png').convert('RGB')
    diff = ImageChops.difference(a, b)
    comparisons[key] = {
        'changedPixels': sum(pixel != (0, 0, 0) for pixel in diff.get_flattened_data()),
        'differenceBounds': diff.getbbox(),
        'metricDelta': {m: after['stats'][key][m] - before['stats'][key][m]
                        for m in ['drawCalls', 'triangles', 'geometries', 'textures']}
    }
guards = ['world-only', 'giant-guard', 'boss-guard']
assert all(comparisons[key]['changedPixels'] == 0 for key in guards)
assert before['errors'] == after['errors'] == []
result = {'baseline': 'd219cbfab4c6a13f5fafebebbb8754ea903f8643',
          'viewport': before['viewport'], 'devicePixelRatio': 2,
          'playerFreeGuardsPixelIdentical': guards, 'comparisons': comparisons,
          'projectedCrownHeightCssPixels': {
              'baseline': before['stats']['idle']['projectedHeight'],
              'prototype': after['stats']['idle']['projectedHeight']}}
(root / 'comparison.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result, indent=2))
