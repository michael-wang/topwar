import { afterEach, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio/GameAudio';

function recoverySetup() {
  const context = { state: 'running', currentTime: 0, destination: {}, resume: async () => {}, close: async () => {},
    createGain: () => ({ gain: param(), connect: vi.fn(), disconnect: vi.fn() }),
    createOscillator: () => ({ frequency: param(), connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }) };
  // Model the observed dormant-bus failure: future automation can stay stale.
  // Only an explicit value at the current audio clock is guaranteed to take effect.
  function param() {
    const p = { value: 1, cancelScheduledValues: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
      setValueAtTime: vi.fn((value: number, at: number) => { if (at <= context.currentTime) p.value = value; }),
      setTargetAtTime: vi.fn((value: number) => { p.value = value; }) };
    return p;
  }
  vi.stubGlobal('AudioContext', function () { return context; });
  const audio = new GameAudio();
  const bus = () => (audio as unknown as { weaponBus: ReturnType<typeof context.createGain> }).weaponBus;
  return { audio, context, bus };
}

it.each(['rifle', 'machineGun'] as const)('%s recovers after every one of three Grenades even if the scheduled ramp stays stale', async kind => {
  const { audio, context, bus } = recoverySetup(); await audio.activate();
  const shot = (id: number) => audio.observe(1, 1, [], context.currentTime * 1000, [{ id, kind, tier: 1 }]);
  shot(1);
  for (let n = 1; n <= 3; n++) {
    context.currentTime = n;
    audio.play('grenadeLaunch'); expect(bus().gain.value).toBe(.25);
    context.currentTime = n + .1; shot(n * 3);
    expect(bus().gain.value).toBe(.25); // Do not cancel the short intentional duck.
    context.currentTime = n + .3; shot(n * 3 + 1);
    expect(bus().gain.value).toBe(1);
    expect(bus().gain.setValueAtTime).toHaveBeenLastCalledWith(1, context.currentTime);
  }
  audio.dispose();
});

it('retains the latest supply/launch window, radio ducking, suspended clock and Retry/terminal-silence ownership', async () => {
  const { audio, context, bus } = recoverySetup(); await audio.activate(); audio.play('rifle');
  audio.syncRadio('en', 0, false);
  audio.play('grenadeLaunch'); context.currentTime = .1; audio.play('supplyOpen');
  context.currentTime = .3; audio.play('rifle'); expect(bus().gain.value).toBe(.3);
  context.currentTime = .56; audio.play('rifle'); expect(bus().gain.value).toBe(1);
  audio.play('supplyOpen'); context.currentTime = .6; audio.play('grenadeLaunch');
  context.currentTime = .8; audio.play('machineGun'); expect(bus().gain.value).toBe(.25);
  context.state = 'suspended'; context.currentTime = .9; audio.play('machineGun'); expect(bus().gain.value).toBe(.25);
  context.state = 'running'; await audio.activate(); audio.play('machineGun'); expect(bus().gain.value).toBe(1);
  const radio = (audio as unknown as { radioDuckBus: ReturnType<typeof context.createGain> }).radioDuckBus;
  expect(radio.gain.exponentialRampToValueAtTime).toHaveBeenLastCalledWith(.6, .15);
  audio.play('grenadeLaunch'); audio.silenceWeapons(); context.currentTime = 2; audio.play('rifle');
  expect(bus().gain.value).toBe(0); // An old recovery must not undo Victory silence.
  audio.resetObservation(); expect(bus().gain.value).toBe(1);
  audio.observe(1, 1, [], 0, [{ id: 1, kind: 'rifle', tier: 1 }]);
  expect(bus().gain.value).toBe(1); audio.dispose();
});
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
