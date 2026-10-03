// Presentation palette only. No combat values or faction gameplay live here.
export const ART = {
  // Defense-only coastal diorama. Keep faction colors and the legacy bridge palette independent.
  coastalDefense: {
    plaster: '#f1efe6', plasterShade: '#c5cdd0', sand: '#d8c49b', sandShade: '#b69d78',
    shallowAqua: '#58c8c1', deepSea: '#247e9c', waterLight: '#c4efdf', foam: '#e5f6ee',
    sky: '#78bde0', horizon: '#b7d8e3', shadow: '#2c4158', secondaryShadow: '#405a6d',
    foliageDark: '#294735', foliageLight: '#507455', bark: '#685a45',
    cloth: '#84cbd4', clothIvory: '#e1e5d6', flower: '#c51e67',
    rust: '#985e49', charcoal: '#3a4348', fire: '#f58a48', scorch: '#53606a',
    camera: { verticalFov: 48, referenceAspect: 9 / 16 },
    fogNear: 105, fogFar: 168, shorelineZ: 53,
    lighting: { sky: '#c5e5f2', ground: '#405a6d', sun: '#fff0d5',
      hemisphereIntensity: 1.65, sunIntensity: 2.2, exposure: 1.35, sunPosition: [-8, 12, -6] },
  },
  world: { sand: '#e0c79b', sandShade: '#9c805e', foam: '#e6dcbc', sea: '#638c99',
    fog: '#96aeb9', near: '#465e6d', nearAccent: '#768793', mid: '#718893',
    midAccent: '#9aa9ad', far: '#8da4ae', concrete: '#a29a85', steel: '#455c6a', rust: '#9c705a' },
  faction: { player: '#287fc6', playerLight: '#67b9e3', grunt: '#6f7c5a', gruntLight: '#94a081',
    heavy: '#6f7c5a', heavyBody: '#61704f', equipment: '#243b4a', weapon: '#263a43',
    giant: '#6f7c5a', gold: '#edb64f', skin: '#e4ad8a', leather: '#65534f', shoes: '#a7b6bd' },
  raider: { helmet: '#6f7c5a', helmetLight: '#94a081', body: '#61704f', bodyDeep: '#536246',
    shorts: '#62727a', stone: '#c6b68c', rim: '#4c5945', hardware: '#49555c' },
  fx: { core: '#fff7e8', gold: '#f7cd76', impact: '#ff734b', ember: '#d74848',
    ash: '#e9dfc2', dust: '#cfb994', gray: '#a2b2b8' },
  bar: { ink: '#293e4c', deep: '#1c2d39', frame: '#ac865a', highlight: '#e3c596',
    paper: '#f6e8c9', shadow: '#172d3a',
    cornerFraction: .45, edgeFraction: .07 },
  // Enemy health is danger, never the gold of rewards or progression.
  enemyHealth: { heavy: '#f2555f', giant: '#ef4d59', depleted: '#c92f4e', hit: '#ffe6df',
    deep: '#1c2d39', ink: '#24465a', frame: '#f1efe6', highlight: '#f7f4ea', shadow: '#172d3a' },
  // Plaster structures, sea progression, navy legibility; sun is a rare accent.
  coastalUi: { plaster: '#f1efe6', paper: '#f7f4ea', ink: '#24465a', sea: '#247e9c',
    aqua: '#58c8c1', foam: '#e5f6ee', shadow: '#2c4158', sun: '#f7cd76',
    crest: '#bae9e0', energy: '#c6f4f2', gutterOuter: '#182f3b' },
  // Fixed full-track sea-to-aqua palette, progressively revealed by the XP mask.
  xp: [{ at: 0, color: '#247e9c' }, { at: .4, color: '#329dac' },
    { at: .7, color: '#58c8c1' }, { at: 1, color: '#70d7cf' }],
} as const;
