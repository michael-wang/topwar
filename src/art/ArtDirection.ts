// Presentation palette only. No combat values or faction gameplay live here.
export const ART = {
  // Coastal diorama and accepted faction colors.
  coastalDefense: {
    plaster: '#f1efe6', plasterShade: '#c5cdd0', sand: '#d8c49b', sandShade: '#b69d78',
    shallowAqua: '#58c8c1', deepSea: '#247e9c', waterLight: '#c4efdf', foam: '#e5f6ee',
    sky: '#78bde0', horizon: '#b7d8e3', shadow: '#2c4158', secondaryShadow: '#405a6d',
    foliageDark: '#294735', foliageLight: '#507455', bark: '#685a45',
    cloth: '#397eb5', clothIvory: '#e1e5d6', flower: '#c51e67',
    rust: '#985e49', charcoal: '#3a4348', fire: '#f58a48', scorch: '#53606a',
    camera: { verticalFov: 48, referenceAspect: 9 / 16 }, // Pre-dolly reference; CoastalCamera derives the final FOV.
    laneHighlights: { playerColor: '#39bdd3', dangerColor: '#ed343c', playerOpacity: .18, dangerOpacity: .22,
      startZ: -.4, endZ: 42, fadeFromZ: 24, playerWidthFraction: 1.12, dangerFeatherFraction: .12 },
    fogNear: 105, fogFar: 168, shorelineZ: 45,
    lighting: { sky: '#c5e5f2', ground: '#405a6d', sun: '#fff0d5',
      hemisphereIntensity: 1.65, sunIntensity: 2.2, exposure: 1.35, sunPosition: [-8, 12, -6] },
  },
  world: { fog: '#96aeb9', near: '#465e6d', steel: '#455c6a' },
  faction: { player: '#287fc6', playerLight: '#67b9e3', grunt: '#6f7c5a', gruntLight: '#94a081',
    heavy: '#6f7c5a', heavyBody: '#61704f', equipment: '#243b4a', weapon: '#263a43',
    giant: '#6f7c5a', gold: '#edb64f', skin: '#e4ad8a', leather: '#65534f', shoes: '#a7b6bd' },
  footwear: { playerUpper: '#778e9c', playerSole: '#647b88', enemyUpper: '#7d8b84', enemySole: '#667770' },
  raider: { helmet: '#6f7c5a', helmetLight: '#94a081', body: '#61704f', bodyDeep: '#536246',
    shorts: '#62727a', stone: '#c6b68c', rim: '#4c5945', hardware: '#49555c' },
  // Shared antique enemy armory; silhouettes, rather than tiny trim, identify roles.
  enemyArmory: { armor: '#465947', iron: '#293537', steel: '#637778',
    sand: '#b8a579', ivory: '#dfd5b8', copper: '#956746', warning: '#e6ad44',
    heavy: '#7c888c', giant: '#73564a', vehicle: '#3c4d54' },
  fx: { core: '#fff7e8', gold: '#f7cd76', impact: '#ff734b', ember: '#d74848',
    dust: '#cfb994', gray: '#a2b2b8' },
  defenseTracer: { core: '#fff9e8', outline: '#ff881a', headInk: '#fff7d9', headLengthRatio: .12, noseLengthRatio: .08, tailOpacity: .72, coreLengthRatio: .55,
    corePixels: 2.5, outlinePixels: 3.2, lengthPixels: 27, minCoreWidth: .014,
    maxCoreWidth: .26, maxOutlineWidth: .3, maxLength: 2.6 },
  bar: { ink: '#293e4c', deep: '#1c2d39', frame: '#ac865a', highlight: '#e3c596',
    paper: '#f6e8c9', shadow: '#172d3a',
    cornerFraction: .45, edgeFraction: .07 },
  // Enemy health is danger, never the gold of rewards or progression.
  enemyHealth: { heavy: '#f2555f', giant: '#ef4d59', depleted: '#c92f4e', hit: '#ffe6df',
    deep: '#1c2d39', ink: '#24465a', frame: '#f1efe6', highlight: '#f7f4ea', shadow: '#172d3a' },
  // Retained coastal hints, overlays and gutters; combat HUD colors are independent.
  coastalUi: { plaster: '#f1efe6', paper: '#f7f4ea', ink: '#24465a', sea: '#247e9c',
    aqua: '#58c8c1', foam: '#e5f6ee', shadow: '#2c4158', sun: '#f7cd76',
    crest: '#bae9e0', energy: '#c6f4f2', gutterOuter: '#182f3b' },
  // Independent combat progression palette, revealed by the full-track XP mask.
  xp: [{ at: 0, color: '#d83b27' }, { at: .45, color: '#f56724' },
    { at: .7, color: '#ff972f' }, { at: 1, color: '#ffd066' }],
} as const;
