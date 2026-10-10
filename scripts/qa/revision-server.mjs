// Serve an exact historical source revision through Vite without changing the checkout.
// Models/art must be unchanged. With --balance, serve the exact historical
// authored game.json too, for matched balance/scheduling comparisons.
import {execFileSync} from 'node:child_process';
import {relative} from 'node:path';
import {createServer} from 'vite';
const revision=execFileSync('git',['rev-parse','--verify',process.argv[2]],{encoding:'utf8'}).trim();
const root=process.cwd(),cache=new Map();
const changedPublic=execFileSync('git',['diff',revision,'--name-only','--','public'],{encoding:'utf8'}).trim();
const balance = process.argv.includes('--balance');
if(changedPublic && (!balance || changedPublic.split('\n').some(p=>p!=='public/game-data/game.json')))
 throw Error('Historical source comparison requires unchanged public assets (except opted-in game.json)');
const oldConfig = balance ? execFileSync('git',['show',`${revision}:public/game-data/game.json`],{encoding:'utf8'}) : null;
const sources=new Set(execFileSync('git',['ls-tree','-r','--name-only',revision,'src'],{encoding:'utf8'}).trim().split('\n'));
const server=await createServer({server:{host:'127.0.0.1',port:5174,strictPort:true},plugins:[{
 name:'historical-ui-source',enforce:'pre',configureServer(server){
  if(oldConfig)server.middlewares.use((req,res,next)=>{
    if(!/^\/game-data\/game(?:\.[a-f0-9]+)?\.json(?:\?.*)?$/.test(req.url??''))return next();
    res.setHeader('Content-Type','application/json');res.end(oldConfig);
  });
 },load(id){
  const path=relative(root,id.split('?')[0]).replaceAll('\\','/');
  if(!sources.has(path))return null;
  if(!cache.has(path))cache.set(path,execFileSync('git',['show',`${revision}:${path}`],{encoding:'utf8'}));
  return cache.get(path);
 }
}]});
await server.listen();console.log(`Historical source ${revision} on http://127.0.0.1:5174/`);
