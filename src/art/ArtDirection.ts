// Presentation palette only. No combat values or faction gameplay live here.
export const ART = {
  world: { sand: '#e0c79b', sandShade: '#9c805e', foam: '#e6dcbc', sea: '#638c99',
    fog: '#96aeb9', near: '#465e6d', nearAccent: '#768793', mid: '#718893',
    midAccent: '#9aa9ad', far: '#8da4ae', concrete: '#a29a85', steel: '#455c6a', rust: '#9c705a' },
  faction: { player: '#2879cb', playerLight: '#74b9e0', grunt: '#ad3d4b', gruntLight: '#d77869',
    heavy: '#daa34c', giant: '#c83e4c', gold: '#edb64f', skin: '#e0b090', leather: '#65534f' },
  fx: { core: '#fff7e8', gold: '#f7cd76', impact: '#ff734b', ember: '#d74848',
    ash: '#e9dfc2', dust: '#cfb994', gray: '#a2b2b8' },
  bar: { ink: '#293e4c', deep: '#1c2d39', frame: '#ac865a', highlight: '#e3c596',
    paper: '#f6e8c9', shadow: '#172d3a', xpRed: '#872e3c', xpOrange: '#e47d39', xpGold: '#ffe184',
    cornerFraction: .45, edgeFraction: .07 },
} as const;
