import {afterEach,expect,it,vi} from 'vitest';
import {GameAudio} from '../src/audio/GameAudio';
import {supportEngineEnvelope,supportFlightZ} from '../src/presentation/SupportFlyover';
afterEach(()=>vi.unstubAllGlobals());
it('swells smoothly around the real overhead pass and recedes to silence',()=>{
  const duration=20.75,pass=7.5-11/18;
  expect(supportFlightZ(pass,7.5)).toBeCloseTo(0);
  expect(supportEngineEnvelope(0,7.5,duration)).toBe(0);
  expect(supportEngineEnvelope(duration,7.5,duration)).toBe(0);
  expect(supportEngineEnvelope(pass,7.5,duration)).toBeCloseTo(1);
  expect(supportEngineEnvelope(4,7.5,duration)).toBeLessThan(.5);
  expect(supportEngineEnvelope(13,7.5,duration)).toBeLessThan(.2);
  let prior=0;
  for(let t=0;t<=duration;t+=.01){const gain=supportEngineEnvelope(t,7.5,duration);expect(gain).toBeGreaterThanOrEqual(0);expect(gain).toBeLessThanOrEqual(1);expect(Math.abs(gain-prior)).toBeLessThan(.01);prior=gain;}
});
it('owns one bounded filtered engine group, ducks live radio and resumes the saved flight age without stacking',async()=>{
  const param=()=>({value:1,setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn(),setValueCurveAtTime:vi.fn()});
  const sourceNode=()=> ({type:'',frequency:param(),connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null as (()=>void)|null});
  const gainNode=()=>({gain:param(),connect:vi.fn(),disconnect:vi.fn()});
  const filterNode=()=>({type:'',frequency:param(),connect:vi.fn(),disconnect:vi.fn()});
  const sources:ReturnType<typeof sourceNode>[]=[],gains:ReturnType<typeof gainNode>[]=[],filters:ReturnType<typeof filterNode>[]=[];
  const source=()=>{const n=sourceNode();sources.push(n);return n;},gain=()=>{const n=gainNode();gains.push(n);return n;},filter=()=>{const n=filterNode();filters.push(n);return n;};
  const context={state:'running',currentTime:0,sampleRate:8000,destination:{},resume:async()=>{},close:async()=>{},createGain:gain,createOscillator:source,createBiquadFilter:filter};
  vi.stubGlobal('AudioContext',function(){return context;});const audio=new GameAudio();await audio.activate();
  audio.syncSupportFlyover(0,false,20.75);expect(sources).toHaveLength(15);expect(filters).toHaveLength(1);expect(filters[0].frequency.value).toBe(520);
  const curves=gains.slice(2,11).map(g=>g.gain.setValueCurveAtTime.mock.calls[0][0] as Float32Array);
  expect(curves).toHaveLength(9);for(const curve of curves){expect(curve[0]).toBe(0);expect(curve.at(-1)).toBe(0);}
  for(let i=0;i<256;i++)expect(curves.reduce((sum,c)=>sum+c[i],0)).toBeLessThanOrEqual(.405001);
  audio.syncSupportFlyover(1,false,20.75);expect(sources).toHaveLength(15);
  audio.syncRadio('en',null,false);audio.syncRadio('en',.1,false);expect(gains[1].gain.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(.38,.15);
  audio.syncRadio('en',null,false);expect(gains[1].gain.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(1,.15);
  audio.syncSupportFlyover(8,true,20.75);expect(audio.getDebugStats().sfxSources).toBe(0);
  context.currentTime=10;audio.syncSupportFlyover(8,false,20.75);expect(sources).toHaveLength(29);expect(filters).toHaveLength(1); // five remaining whistles
  const resumed=gains[17].gain.setValueCurveAtTime.mock.calls[0];expect(resumed[1]).toBe(10);expect(resumed[2]).toBe(12.75);
  const curve=resumed[0] as Float32Array;expect(curve[100]).toBeLessThan(curve[10]);
  audio.resetObservation();expect(audio.getDebugStats().sfxSources).toBe(0);
  audio.syncSupportFlyover(21,false,20.75);expect(sources).toHaveLength(29);
  audio.dispose();expect(filters[0].disconnect).toHaveBeenCalledOnce();expect(gains[1].disconnect).toHaveBeenCalledOnce();
  for(const s of sources)s.onended?.();expect(sources.every(s=>s.disconnect.mock.calls.length===1)).toBe(true);
});
