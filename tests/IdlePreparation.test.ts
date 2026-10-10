import { afterEach, expect, it, vi } from 'vitest';
import { IdlePreparation } from '../src/presentation/IdlePreparation';
import { GameAudio } from '../src/audio/GameAudio';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it('runs one bounded step per idle callback and cancels outstanding work on disposal', async () => {
  const callbacks: IdleRequestCallback[] = [], cancel = vi.fn();
  vi.stubGlobal('requestIdleCallback', (callback: IdleRequestCallback) => callbacks.push(callback));
  vi.stubGlobal('cancelIdleCallback', cancel);
  const work = vi.fn();
  function* steps() { for(let i=0;i<3;i++){work();yield;} }
  const queue = new IdlePreparation(steps()); expect(work).not.toHaveBeenCalled();
  callbacks.shift()!({timeRemaining:()=>0,didTimeout:true});
  expect(work).toHaveBeenCalledOnce();await Promise.resolve();expect(callbacks).toHaveLength(1);
  queue.dispose();callbacks.shift()!({timeRemaining:()=>10,didTimeout:false});
  expect(work).toHaveBeenCalledOnce();expect(cancel).toHaveBeenCalledOnce();
});
it('uses cancellable small timer steps without idle callback support', async () => {
  vi.useFakeTimers();vi.stubGlobal('requestIdleCallback',undefined);vi.stubGlobal('cancelIdleCallback',undefined);
  const work=vi.fn();function* steps(){work();yield;work();}
  const queue=new IdlePreparation(steps());await vi.advanceTimersByTimeAsync(32);
  expect(work).toHaveBeenCalledOnce();queue.dispose();await vi.advanceTimersByTimeAsync(100);
  expect(work).toHaveBeenCalledOnce();
});
it('prepares identical audio samples in bounded chunks and retains buffers across Retry', () => {
  const context={sampleRate:48000,createBuffer:(_channels:number,frames:number)=>{
    const samples=new Float32Array(frames);return{getChannelData:()=>samples};
  }} as unknown as AudioContext;
  const audio=new GameAudio() as any;
  for(const [sync,chunked] of [['createGrenadeBuffer','grenadeSamples'],['createRumbleBuffer','rumbleSamples']]){
    const expected=audio[sync](context).getChannelData(0),steps=audio[chunked](context);let count=0,next;
    do {next=steps.next();count++;}while(!next.done);
    expect(count).toBe(Math.floor(expected.length/2048)+1);
    expect(next.value.getChannelData(0)).toEqual(expected);
  }
  const steps=audio.prepareEffects(context);while(!steps.next().done){}
  const grenade=audio.grenadeBuffer,rumble=audio.rumbleBuffer;
  audio.resetObservation();expect(audio.grenadeBuffer).toBe(grenade);expect(audio.rumbleBuffer).toBe(rumble);audio.dispose();
});
