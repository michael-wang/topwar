import { afterEach, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio/GameAudio';
afterEach(()=>vi.unstubAllGlobals());
it('synthesizes blast, bass and noise tail, caps overlap, and stops active tails on Retry',async()=>{
  const param=()=>({value:1,setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn()});
  const sources:{start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>}[]=[];
  const source=()=>{const node={type:'',buffer:null,frequency:param(),connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};sources.push(node);return node;};
  const context={state:'running',currentTime:0,sampleRate:8000,destination:{},resume:async()=>{},close:async()=>{},
    createGain:()=>({gain:param(),connect:vi.fn(),disconnect:vi.fn()}),createOscillator:vi.fn(source),createBufferSource:vi.fn(source),
    createBiquadFilter:()=>({type:'',frequency:param(),connect:vi.fn(),disconnect:vi.fn()}),
    createBuffer:vi.fn((_channels:number,frames:number)=>({getChannelData:()=>new Float32Array(frames)}))};
  vi.stubGlobal('AudioContext',function(){return context;});const audio=new GameAudio();await audio.activate();
  audio.play('grenadeExplosion');expect(sources).toHaveLength(4);expect(sources[3].stop).toHaveBeenCalledWith(1.1);
  for(let i=0;i<10;i++)audio.play('grenadeExplosion');expect(sources).toHaveLength(4);
  context.currentTime=.65;audio.play('grenadeExplosion');expect(audio.getDebugStats().sfxSources).toBe(8);
  context.currentTime=1.3;audio.play('grenadeExplosion');expect(audio.getDebugStats().sfxSources).toBe(8);
  expect(sources.slice(0,4).every(s=>s.stop.mock.calls.length===2)).toBe(true);
  expect(context.createBuffer).toHaveBeenCalledOnce();
  audio.resetObservation();expect(sources.slice(4).every(s=>s.stop.mock.calls.length===2)).toBe(true);
  // Retry also resets cue admission, even at the same audio-clock time.
  audio.play('grenadeExplosion');expect(sources).toHaveLength(16);audio.dispose();
});

it('uses dedicated artillery reports with bounded overlap and cancels tails on Pause and Retry',async()=>{
  const param=()=>({value:1,setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn()});
  const sources:{stop:ReturnType<typeof vi.fn>}[]=[];
  const source=()=>{const node={type:'',buffer:null,frequency:param(),connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};sources.push(node);return node;};
  const context={state:'running',currentTime:0,sampleRate:8000,destination:{},resume:async()=>{},close:async()=>{},
    createGain:()=>({gain:param(),connect:vi.fn(),disconnect:vi.fn()}),createOscillator:vi.fn(source),createBufferSource:vi.fn(source),
    createBiquadFilter:()=>({type:'',frequency:param(),connect:vi.fn(),disconnect:vi.fn()}),
    createBuffer:vi.fn((_channels:number,frames:number)=>({getChannelData:()=>new Float32Array(frames)}))};
  vi.stubGlobal('AudioContext',function(){return context;});const audio=new GameAudio();await audio.activate();
  audio.play('enemyCannon'); expect(sources).toHaveLength(4);
  audio.play('enemyShellImpact'); expect(sources).toHaveLength(8);
  for(let i=0;i<20;i++)audio.play('enemyShellImpact');
  expect(audio.getDebugStats().sfxSources).toBe(8); expect(context.createBuffer).toHaveBeenCalledOnce();
  audio.silenceArtillery(); expect(audio.getDebugStats().sfxSources).toBe(0);
  audio.play('enemyCannon'); audio.resetObservation(); expect(audio.getDebugStats().sfxSources).toBe(0);
  expect(sources.every(s=>s.stop.mock.calls.length>=2)).toBe(true); audio.dispose();
});
