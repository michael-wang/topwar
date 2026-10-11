import { afterEach, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio/GameAudio';
afterEach(()=>vi.unstubAllGlobals());
it('uses three short procedural launch voices and ducks only weapon audio, with softer radio overlap',async()=>{
  const param=()=>({value:1,setValueAtTime:vi.fn(),exponentialRampToValueAtTime:vi.fn(),cancelScheduledValues:vi.fn()});
  const gains:{gain:ReturnType<typeof param>;connect:ReturnType<typeof vi.fn>;disconnect:ReturnType<typeof vi.fn>}[]=[];
  const sources:{frequency:ReturnType<typeof param>;start:ReturnType<typeof vi.fn>;stop:ReturnType<typeof vi.fn>}[]=[];
  const context={state:'running',currentTime:2,sampleRate:8000,destination:{},resume:async()=>{},close:async()=>{},
    createGain:()=>{const node={gain:param(),connect:vi.fn(),disconnect:vi.fn()};gains.push(node);return node;},
    createOscillator:()=>{const node={type:'',frequency:param(),connect:vi.fn(),disconnect:vi.fn(),start:vi.fn(),stop:vi.fn(),onended:null};sources.push(node);return node;}};
  vi.stubGlobal('AudioContext',function(){return context;});const audio=new GameAudio();await audio.activate();
  audio.play('machineGun');const before=sources.length,master=gains[0],weapon=gains[1],radio=gains[2];
  audio.play('grenadeLaunch');expect(sources).toHaveLength(before+3);
  expect(sources.slice(before).map(s=>s.stop.mock.calls[0][0])).toEqual([2.055,2.1,2.235]);
  expect(weapon.gain.setValueAtTime).toHaveBeenCalledWith(.25,2);
  expect(weapon.gain.exponentialRampToValueAtTime).toHaveBeenCalledWith(1,2.26);
  expect(master.gain.cancelScheduledValues).not.toHaveBeenCalled();expect(radio.gain.cancelScheduledValues).not.toHaveBeenCalled();
  (audio as unknown as {radioActive:boolean}).radioActive=true;const gainBefore=gains.length;audio.play('grenadeLaunch');
  expect(gains[gainBefore].gain.setValueAtTime).toHaveBeenCalledWith(.075*.65,2);
  audio.resetObservation();expect(sources.every(s=>s.stop.mock.calls.length===2)).toBe(true);audio.dispose();
});
