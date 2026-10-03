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
    fogNear: 105, fogFar: 168, shorelineZ: 53,
    lighting: { sky: '#c5e5f2', ground: '#405a6d', sun: '#fff0d5',
      hemisphereIntensity: 1.65, sunIntensity: 2.2, exposure: 1.35, sunPosition: [-8, 12, -6] },
  },
  world: { sand: '#e0c79b', sandShade: '#9c805e', foam: '#e6dcbc', sea: '#638c99',
    fog: '#96aeb9', near: '#465e6d', nearAccent: '#768793', mid: '#718893',
    midAccent: '#9aa9ad', far: '#8da4ae', concrete: '#a29a85', steel: '#455c6a', rust: '#9c705a' },
  faction: { player: '#2879cb', playerLight: '#74b9e0', grunt: '#ad3d4b', gruntLight: '#d77869',
    heavy: '#daa34c', giant: '#c83e4c', gold: '#edb64f', skin: '#e0b090', leather: '#65534f' },
  fx: { core: '#fff7e8', gold: '#f7cd76', impact: '#ff734b', ember: '#d74848',
    ash: '#e9dfc2', dust: '#cfb994', gray: '#a2b2b8' },
  bar: { ink: '#293e4c', deep: '#1c2d39', frame: '#ac865a', highlight: '#e3c596',
    paper: '#f6e8c9', shadow: '#172d3a',
    cornerFraction: .45, edgeFraction: .07 },
  // Pass through cyan-white/ivory before gold; direct blue/yellow mixing reads green.
  xp: [{ at: 0, color: '#a9d4ef' }, { at: .4, color: '#b9e0f7' },
    { at: .6, color: '#daf3ff' }, { at: .7, color: '#f1f8fa' },
    { at: .82, color: '#f7e9bf' }, { at: .9, color: '#ffdb6f' }, { at: 1, color: '#fff28f' }],
} as const;
