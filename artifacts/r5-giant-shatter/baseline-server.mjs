import { createServer } from 'vite';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
export const baseline = '4c7c0a709f1d047dad6c0658fbe5aceb5b8c1268';
export const paths = ['src/rendering/enemies/ChibiThreatFamilies.ts', 'src/rendering/enemies/GiantRenderer.ts',
 'src/rendering/enemies/DeathBurst.ts', 'src/presentation/EnemyDeathTiming.ts', 'src/rendering/CharacterVisualFamilies.ts', 'src/presentation/CharacterMotion.ts', 'src/config/catharsisConfig.ts'];
export const baselineGameData = () => execFileSync('git',['show',`${baseline}:public/game-data/game.json`],{encoding:'utf8'});
export async function baselineServer(){
 const sources=new Map(paths.map(path=>[resolve(path).replaceAll('\\','/'),execFileSync('git',['show',`${baseline}:${path}`],{encoding:'utf8'})]));
 const server=await createServer({server:{host:'127.0.0.1',port:5180,strictPort:true},plugins:[{name:'r4-baseline',enforce:'pre',load(id){return sources.get(id.split('?')[0]);}}]});
 await server.listen();return server;
}
