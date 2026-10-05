import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { DEATH_COMPOSITIONS } from './DeathVisualSeed';
import type { EnemyDeathRole } from '../../presentation/EnemyDeathTiming';

export const SPLASH_COMPOSITIONS = DEATH_COMPOSITIONS;
export const RIBBON_COUNTS = { grunt: 3, heavy: 4, giant: 5 } as const;
export const RIBBON_LIFETIME_MS = { grunt: 150, heavy: 210, giant: 320 } as const;
export const RIBBON_DELAY_MS={grunt:15,heavy:22,giant:35} as const;
export const DROPLET_COUNTS = { grunt: 6, heavy: 8, giant: 10 } as const;
export const SPLASH_COLORS = ['#751d27', '#9f2734', '#c93443'] as const;
export const HERO_RIBBON_COUNTS = { grunt: 0, heavy: 2, giant: 2 } as const;
export const HERO_FRONT_BIAS = { heavy: .32, giant: .38 } as const;
const ANCHORS = { grunt: [[-.08,.29,.06],[.09,.32,.02]],
  heavy: [[-.12,.28,.14],[.14,.32,.13],[0,.42,.08]],
  giant: [[-.19,.58,.12],[.18,.64,.08],[0,.75,.08],[-.08,.39,.16]] } as const;
export const activeRibbonCount=(role:EnemyDeathRole,composition:number)=>RIBBON_COUNTS[role]-(composition%3===0?0:1);
export const activeDropletCount=(role:EnemyDeathRole,composition:number)=>DROPLET_COUNTS[role]-2+composition%3;
export interface RibbonShape { origin: THREE.Vector3; direction: THREE.Vector3; length: number; width: number; bend: number; delay: number; extensionRate: number }
// Coherent directions, shared by the stretching root and its detached droplets.
export const splashShapes = Object.fromEntries((['grunt','heavy','giant'] as const).map(role => [role,
  Array.from({length:SPLASH_COMPOSITIONS}, (_,composition) => Array.from({length:RIBBON_COUNTS[role]}, (_,ribbon): RibbonShape => {
    const side=ribbon%2?-1:1,family=composition%6;
    const x=family===0?-1.15+(ribbon%3)*.30:family===1?1.15-(ribbon%3)*.30:side*(family===3?1.3:.8);
    const y=family===2?1.25:family===3?.10:family===4?(ribbon%2?.12:1.0):.45+ribbon*.11;
    const direction=new THREE.Vector3(x,y,(ribbon%3===1?-1:1)*(.64+.28*Math.sin(ribbon*2.1+composition))).normalize();
    const origin=new THREE.Vector3(...ANCHORS[role][ribbon%ANCHORS[role].length]);
    origin.x+=.025*Math.sin(composition*2.2+ribbon);origin.y+=.020*Math.cos(composition+ribbon*1.8);
    if (role !== 'grunt' && ribbon === 2) direction.z = -Math.abs(direction.z);
    const hero = role !== 'grunt' && ribbon < HERO_RIBBON_COUNTS[role];
    if (hero) {
      // Defense bodies face local +Z, rotated PI around Y in world space:
      // +Z is the player-facing -Z inner shell, not an origin outside the skin.
      origin.set(side * (role === 'giant' ? .14 : .10),
        (role === 'giant' ? .61 : .34) + .025 * Math.sin(composition + ribbon), role === 'giant' ? .23 : .20);
      const front = HERO_FRONT_BIAS[role], elevation = .48 + .09 * Math.sin(composition * 1.7 + ribbon);
      direction.set(side * Math.sqrt(1 - front * front - elevation * elevation), elevation, front);
    }
    return {origin,direction,length:({grunt:.59,heavy:.67,giant:.73})[role]*(1+.18*Math.sin(ribbon*2+composition))*(ribbon===RIBBON_COUNTS[role]-1?.62:1),
      width:({grunt:.125,heavy:.15,giant:.18})[role]*(1+.22*Math.cos(ribbon+composition*1.7)),
      bend:side*(.08+.07*Math.sin(ribbon+composition)),delay:family===5&&ribbon%2===1?RIBBON_DELAY_MS[role]/1000:0,
      extensionRate: hero ? (role === 'giant' ? 1.20 : 1.15) : 1};
  }))])) as Record<EnemyDeathRole,RibbonShape[][]>;

// Six sections of a thin rounded extrusion, 92 triangles including rounded end caps.
// Smooth normals/continuous tint avoid angular panel shading. No camera basis.
export function fluidRibbonGeometry(role: EnemyDeathRole): THREE.BufferGeometry {
  const parts=Array.from({length:RIBBON_COUNTS[role]},(_,ribbon)=>{
    const positions:number[]=[],indices:number[]=[],colors:number[]=[],ids:number[]=[];
    const deep=new THREE.Color(SPLASH_COLORS[0]),main=new THREE.Color(SPLASH_COLORS[1]),color=new THREE.Color();
    for(let s=0;s<6;s++){
      const u=s/5,width=[.68,1,.88,.72,.58,.28][s]*(1+.11*Math.sin(s*2.3+ribbon));
      const offset=.16*Math.sin(u*3.1+ribbon*.8)*u;
      for(let ring=0;ring<8;ring++){
        const side=Math.cos(ring*Math.PI/4),depth=Math.sin(ring*Math.PI/4);
        positions.push(side*width+offset,u,depth*.22*width);
        color.copy(deep).lerp(main,.25+.5*u+.08*side);color.toArray(colors,colors.length);ids.push(ribbon);
      }
    }
    for(let s=0;s<5;s++)for(let side=0;side<8;side++){
      const a=s*8+side,b=s*8+(side+1)%8,c=a+8,d=b+8;indices.push(a,b,c,b,d,c);
    }
    for(let i=1;i<7;i++)indices.push(0,i+1,i,40,40+i,41+i);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('bloodPieceId',new THREE.Float32BufferAttribute(ids,1));
    g.setIndex(indices);g.computeVertexNormals();const expanded=g.toNonIndexed();g.dispose();return expanded;
  });const merged=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());return merged;
}
