import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error Vitest runs in Node; project typecheck exposes browser types only.
import { readFileSync } from 'node:fs';
// @ts-expect-error Vitest runs in Node; project typecheck exposes browser types only.
import { createHash } from 'node:crypto';
import { loadObserverLocale, selectObserverLocale, saveObserverLocale, observerDialogue, observerMissionDialogue } from '../src/ui/observerLocale';
import { ObserverTimeline, MissionObserverTimeline, missionIntroTiming } from '../src/presentation/ObserverTimeline';
import { ObserverVoice, ObserverVoiceFiles, observerVoiceAssets, observerMissionVoiceAssets } from '../src/audio/ObserverVoice';
import { destroyerDefaults as config } from '../src/config/destroyerConfig';
import { FieldObserver } from '../src/ui/FieldObserver';
import type { PreparedObserverPortraits } from '../src/ui/ObserverPortraits';
const state = { status: 'active' as const, startedAtSeconds: 0, nextShotIndex: 0 };
afterEach(() => vi.unstubAllGlobals());
it('selects Traditional Chinese browser locales, English fallback and persisted overrides safely', () => {
  for (const locale of ['zh-TW', 'zh-Hant', 'zh-Hant-TW', 'zh-HK']) expect(selectObserverLocale([locale])).toBe('zh-TW');
  for (const locale of ['en-US', 'ja', 'zh-CN', 'zh']) expect(selectObserverLocale([locale])).toBe('en');
  expect(selectObserverLocale(['en'], 'zh-TW')).toBe('zh-TW');
  expect(selectObserverLocale(['zh-TW'], 'invalid')).toBe('zh-TW');
  const storage = { getItem: () => { throw Error('denied'); }, setItem: () => { throw Error('denied'); } };
  expect(loadObserverLocale(['zh-TW'], storage)).toBe('zh-TW');expect(() => saveObserverLocale('en', storage)).not.toThrow();
  expect(observerDialogue.en).toMatch(/Over\.$/);expect(observerDialogue['zh-TW']).toContain('完畢！');
});
it('announces once on the simulation clock, freezes during Pause, and does not replay restored messages', () => {
  const t = new ObserverTimeline();let opens = 0, closes = 0;
  for (let tick = 0; tick < 600; tick++) {
    const frame = t.update(state, config, tick / 60, true);
    opens += Number(frame.begin);closes += Number(frame.end);
    if (tick === 100) for (let i = 0; i < 100; i++) {
      const paused = t.update(state, config, tick / 60, true);
      expect(paused.offset).toBe(frame.offset);expect(paused.begin).toBe(false);
    }
  }
  expect([opens, closes]).toEqual([1, 1]);
  t.reset();expect(t.update(state, config, 2, true)).toMatchObject({ visible: true, audible: false, begin: false });
  expect(t.update(state, config, 2.1, true).audible).toBe(false);
  expect(t.update(state, config, 1.5, true).audible).toBe(false);
  expect(t.update(state, config, 1.6, false).visible).toBe(false);
});
it('does not replay an already-announced encounter after rewinding before its radio cue', () => {
  const t = new ObserverTimeline();let begins = 0;
  for (let tick = 0; tick < 150; tick++) begins += Number(t.update(state, config, tick / 60, true).begin);
  for (let tick = 30; tick < 150; tick++) begins += Number(t.update(state, config, tick / 60, true).begin);
  expect(begins).toBe(1);
  t.reset();let retried = 0;
  for (let tick = 0; tick < 150; tick++) retried += Number(t.update(state, config, tick / 60, true).begin);
  expect(retried).toBe(1);
});
function audioHarness() {
  const nodes: any[] = [];
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: {value:1}, frequency:{value:0}, Q:{value:0} });
  const context = { state:'running', createBufferSource: vi.fn(() => {
    const source = {...node(), start:vi.fn(), stop:vi.fn(), onended:null};nodes.push(source);return source;
  }), createBiquadFilter:node, createGain:node } as unknown as AudioContext;
  return { context, nodes };
}
it.each([0,.5,1,2])('starts a ready mission recording at offset zero after %ss preparation, independent of gameplay time',readyAt=>{
  const t=new MissionObserverTimeline();t.start(0);let beginCount=0,start=0;
  for(let tick=0;tick<600;tick++){
    const now=tick/60,frame=t.update(now,true,false,now>=readyAt?'ready':'pending');
    if(frame.begin){beginCount++;start=now;expect(frame.offset).toBe(0);expect(frame.audible).toBe(true);}
    if(now<Math.max(.2,readyAt))expect(frame.visible).toBe(false);
  }
  expect(beginCount).toBe(1);expect(start).toBeCloseTo(Math.max(.2,readyAt));expect(t.active).toBe(false);
});
it('bounds intro waiting, chooses subtitle-only once and refuses late speech after fallback or completion',()=>{
  const t=new MissionObserverTimeline();t.start(0);let began=0;
  for(let tick=0;tick<660;tick++){
    const now=tick/60,frame=t.update(now,true,false,now>=4?'ready':'pending');
    if(frame.begin){began++;expect(now).toBeCloseTo(.2+missionIntroTiming.readinessWaitSeconds);}
    expect(frame.audible).toBe(false);
  }
  expect(began).toBe(1);expect(t.update(1,true,false,'ready').visible).toBe(false);
});
it('freezes readiness wait and speech on Pause; Retry cancels either phase and starts a fresh attempt',()=>{
  const t=new MissionObserverTimeline();t.start(0);
  for(let tick=0;tick<=60;tick++)t.update(tick/60,true,false,'pending');
  for(let n=0;n<200;n++)expect(t.update(1,true,true,'ready').visible).toBe(false);
  const begun=t.update(1,true,false,'ready');expect(begun).toMatchObject({begin:true,offset:0,audible:true});
  expect(t.update(1.1,true,true,'ready').offset).toBeCloseTo(.1);
  expect(t.update(1.1,true,false,'ready').offset).toBeCloseTo(.1);
  t.start(0);expect(t.update(0,true,false,'ready').visible).toBe(false);
  expect(t.update(.2,true,false,'ready')).toMatchObject({begin:true,offset:0});
  t.start(0);t.update(.1,true,false,'pending');t.start(0);
  expect(t.update(.2,true,false,'ready')).toMatchObject({begin:true,offset:0});
});
it('fetches cold files before activation without creating audio sources, reuses warm bytes, and tolerates missing audio',async()=>{
  const bytes=new ArrayBuffer(8),fetcher=vi.fn(async()=>({ok:true,arrayBuffer:async()=>bytes}));
  vi.stubGlobal('fetch',fetcher);const files=new ObserverVoiceFiles();
  await files.prefetch('/intro.mp3');await files.prefetch('/intro.mp3');expect(fetcher).toHaveBeenCalledOnce();
  const decode=vi.fn(async(_bytes:ArrayBuffer)=>({duration:5.64} as AudioBuffer));
  await files.load('/intro.mp3',{decodeAudioData:decode} as unknown as AudioContext);
  expect(fetcher).toHaveBeenCalledOnce();expect(decode.mock.calls[0]?.[0]).not.toBe(bytes);
  fetcher.mockRejectedValueOnce(Error('offline'));
  expect(await files.load('/missing.mp3',{decodeAudioData:decode} as unknown as AudioContext)).toBeNull();
  expect(await files.load('/missing.mp3',{decodeAudioData:decode} as unknown as AudioContext)).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(2);files.clear();
});
it('never starts an unready mission clip from a late decode callback, including after reset',async()=>{
  const {context,nodes}=audioHarness();let resolve!: (b:AudioBuffer)=>void;
  const loader=vi.fn(()=>new Promise<AudioBuffer>(r=>resolve=r));
  const voice=new ObserverVoice(context,{} as AudioNode,observerVoiceAssets,loader);
  expect(voice.prepare('zh-TW','missionIntro')).toBe('pending');
  voice.sync('zh-TW',0,false,6.2,'missionIntro');voice.sync('zh-TW',1,false,6.2,'missionIntro');voice.reset();
  resolve({duration:5.64} as AudioBuffer);await Promise.resolve();await Promise.resolve();
  expect(nodes).toHaveLength(0);expect(voice.prepare('zh-TW','missionIntro')).toBe('ready');
  voice.sync('zh-TW',0,false,6.2,'missionIntro');await Promise.resolve();
  expect(nodes[0].start).toHaveBeenCalledWith(0,0);voice.dispose();
});
it('bounds hung voice fetches and aborts pending requests on disposal', async () => {
  vi.useFakeTimers();
  const signals: AbortSignal[] = [];
  vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
    const signal = options.signal!; signals.push(signal);
    signal.addEventListener('abort', () => reject(new Error('aborted')));
  })));
  try {
    const files = new ObserverVoiceFiles(), timed = files.prefetch('/intro.mp3');
    await vi.advanceTimersByTimeAsync(8000);
    expect(signals[0].aborted).toBe(true); expect(await timed).toBeNull();
    const pending = files.prefetch('/destroyer.mp3');files.clear();
    expect(signals[1].aborted).toBe(true);expect(await pending).toBeNull();
  } finally { vi.useRealTimers(); }
});
it('bundles the exact approved Mandarin bytes and leaves English without a recording', () => {
  expect(observerVoiceAssets).toEqual({ 'zh-TW': 'audio/observer_destroyer_zh-TW.mp3', en: null });
  const bytes = readFileSync('public/audio/observer_destroyer_zh-TW.mp3');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('3e54fc46e2efbb050b7cb0ab6d863c4a938e13436214e83ef81d56faf3806ae8');
  expect(config.radioDurationSeconds).toBeGreaterThan(6.48);
  expect(config.shotTimes[0]).toBeGreaterThan(config.radioAtSeconds + config.radioDurationSeconds);
});
it('preloads silently, plays once, stops Mandarin on English selection and never truncates a short historical window', async () => {
  const {context,nodes}=audioHarness(), loader=vi.fn(async()=>({duration:5.407} as AudioBuffer));
  const voice=new ObserverVoice(context,{} as AudioNode,observerVoiceAssets,loader);
  voice.sync('zh-TW',null,false);expect(loader).not.toHaveBeenCalled();
  voice.prepare('zh-TW','destroyer');await Promise.resolve();expect(loader).toHaveBeenCalledOnce();expect(nodes).toHaveLength(0);
  voice.sync('zh-TW',0,false,7.2);await Promise.resolve();expect(nodes).toHaveLength(1);expect(nodes[0].start).toHaveBeenCalledWith(0,0);
  for(let i=0;i<10;i++)voice.sync('zh-TW',i/60,false,7.2);expect(nodes).toHaveLength(1);
  voice.sync('en',1,false,7.2);expect(nodes[0].stop).toHaveBeenCalledOnce();expect(nodes).toHaveLength(1);
  voice.reset();voice.sync('zh-TW',0,false,4.2);await Promise.resolve();expect(nodes).toHaveLength(1);
  expect(loader).toHaveBeenCalledOnce();voice.dispose();
});
it('never requests missing recordings; caches failed approved-asset requests without repeated retries', async () => {
  const {context,nodes} = audioHarness(), loader = vi.fn(async () => null);
  const missing = new ObserverVoice(context, {} as AudioNode, {en:null,'zh-TW':null}, loader);
  for(let i=0;i<100;i++)missing.sync('en',i/60,false);
  expect(loader).not.toHaveBeenCalled();expect(nodes).toHaveLength(0);missing.dispose();
  const failed = new ObserverVoice(context, {} as AudioNode, {en:'audio/approved.mp3','zh-TW':null}, loader);
  for(let i=0;i<5;i++){failed.sync('en',0,false);await Promise.resolve();failed.reset();}
  expect(loader).toHaveBeenCalledOnce();expect(nodes).toHaveLength(0);failed.dispose();
});
it('resumes at exact presentation offset and cancels stale asynchronous loads on language switch, Retry and disposal', async () => {
  const {context,nodes} = audioHarness();let resolve!: (v:AudioBuffer) => void;
  const loader=vi.fn((url:string) => url.includes('english') ? new Promise<AudioBuffer>(r=>resolve=r) : Promise.resolve({duration:5} as AudioBuffer));
  const voice=new ObserverVoice(context,{} as AudioNode,{en:'audio/english.mp3','zh-TW':'audio/chinese.mp3'},loader);
  voice.sync('en',0,false);voice.sync('zh-TW',.4,false);await Promise.resolve();await Promise.resolve();
  expect(nodes).toHaveLength(1);expect(nodes[0].start).toHaveBeenCalledWith(0,.4);
  resolve({duration:5} as AudioBuffer);await Promise.resolve();await Promise.resolve();expect(nodes).toHaveLength(1);
  voice.sync('zh-TW',.8,true);expect(nodes[0].stop).toHaveBeenCalledOnce();
  voice.sync('zh-TW',.8,false);await Promise.resolve();expect(nodes[1].start).toHaveBeenCalledWith(0,.8);
  voice.reset();expect(nodes[1].stop).toHaveBeenCalledOnce();
  voice.sync('en',1,false);voice.dispose();await Promise.resolve();expect(nodes).toHaveLength(2);
});
class ElementStub extends EventTarget {
  children: ElementStub[] = []; style: Record<string,string>={}; attrs:Record<string,string>={};
  hidden=false; lang=''; textContent=''; src=''; remove=vi.fn(); blur=vi.fn();
  append(...children:ElementStub[]){this.children.push(...children);}
  replaceWith=vi.fn();
  setAttribute(key:string,value:string){this.attrs[key]=value;}
}
const readyPortraits = (): PreparedObserverPortraits => ({ readiness: 'ready', get: () => new ElementStub() as unknown as HTMLImageElement });
function missionUi(portraits = readyPortraits()) {
  vi.stubGlobal('document',{createElement:()=>new ElementStub()});
  vi.stubGlobal('navigator',{languages:['zh-TW']});vi.stubGlobal('window',{});
  const audio={play:vi.fn(),syncRadio:vi.fn(),prepareRadio:vi.fn(()=> 'ready' as const)};
  const ui=new FieldObserver(new ElementStub() as unknown as HTMLElement,audio,portraits);
  return {ui,audio,text:()=>(ui.element as unknown as ElementStub).children[1].textContent};
}
it('waits for decoded portraits before starting all parts of the mission at offset zero', () => {
  let ready = false;
  const prepared = readyPortraits();
  const {ui,audio} = missionUi({ get readiness() { return ready ? 'ready' : 'pending'; }, get: e => ready ? prepared.get(e) : null });
  ui.startMission(0);
  for (let tick=0; tick<90; tick++) ui.update(undefined,undefined,tick/60,true,false);
  expect(ui.element.hidden).toBe(true);expect(audio.play).not.toHaveBeenCalled();
  ready=true;ui.update(undefined,undefined,1.5,true,false);
  expect(ui.element.hidden).toBe(false);expect(audio.play).toHaveBeenCalledExactlyOnceWith('radioOpen');
  expect(audio.syncRadio.mock.lastCall).toEqual(['zh-TW',0,false,6.2,'missionIntro']);ui.dispose();
});
it('keeps ready speech with an emblem at the portrait deadline, freezes it, and reuses portraits on Retry', () => {
  let ready = false;
  const prepared = readyPortraits();
  const {ui,audio} = missionUi({ get readiness() { return ready ? 'ready' : 'pending'; }, get: e => ready ? prepared.get(e) : null });
  ui.startMission(0);
  for (let tick=0; tick<190; tick++) ui.update(undefined,undefined,tick/60,true,false);
  expect(ui.element.hidden).toBe(false);
  expect((ui as any).portrait.className).toBe('observer-fallback');
  const firstSpeech = audio.syncRadio.mock.calls.find(call=>call[1]!==null);
  expect(firstSpeech).toEqual(['zh-TW',0,false,6.2,'missionIntro']);
  ready=true;
  for (let tick=190; tick<530; tick++) ui.update(undefined,undefined,tick/60,true,false);
  expect((ui as any).portrait.className).toBe('observer-fallback');
  expect(audio.play).toHaveBeenCalledExactlyOnceWith('radioOpen');
  ui.startMission(0);for(let tick=0;tick<20;tick++)ui.update(undefined,undefined,tick/60,true,false);
  expect(ui.element.hidden).toBe(false);expect((ui as any).portrait.className).not.toBe('observer-fallback');
  expect(audio.play).toHaveBeenCalledTimes(2);ui.dispose();
});
it('preserves critical Destroyer subtitles and radio with no portraits, including mission precedence', () => {
  const {ui,audio,text}=missionUi({readiness:'unavailable',get:()=>null});ui.startMission(0);
  for(let tick=0;tick<120;tick++)ui.update(state,config,tick/60,true,false);
  expect(ui.element.hidden).toBe(false);expect(text()).toBe(observerDialogue['zh-TW']);
  expect((ui as any).portrait.className).toBe('observer-fallback');
  expect(audio.syncRadio.mock.lastCall?.[1]).not.toBeNull();ui.dispose();
});
it('makes the audio decision independently when portraits remain pending at the deadline', () => {
  for(const readiness of ['ready','pending','unavailable'] as const){
    const t=new MissionObserverTimeline();t.start(0);let first:any;
    for(let tick=0;tick<180;tick++){const f=t.update(tick/60,true,false,readiness,true);if(f.begin)first=f;}
    expect(first).toMatchObject({visible:true,begin:true,offset:0,audible:readiness==='ready'});
  }
});
it('prepares Mandarin before Start without playing or arming dialogue',()=>{
  const {ui,audio}=missionUi();
  expect(audio.prepareRadio.mock.lastCall).toEqual(['zh-TW','missionIntro']);
  expect(audio.play).not.toHaveBeenCalled();expect(ui.element.hidden).toBe(true);ui.dispose();
});
it('bundles the untouched mission recording and approved short bilingual phrases',()=>{
  const bytes=readFileSync('public/audio/observer_mission_intro_zh-TW.mp3');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('8d681e6d96786f1ede9eccca1e455a74f92211f1c0e45ab685c67da2eca6ff84');
  expect(observerMissionVoiceAssets.en).toBeNull();
  expect(observerMissionDialogue['zh-TW'].join('')).toBe('這裡是觀測官。敵軍正朝港口逼近！請守住防線。完畢！');
  expect(observerMissionDialogue.en.join(' ')).toBe('Field Observer here. Enemy forces are approaching the harbor! Hold the line. Over.');
});
it('presents three mission phrases once, freezes with Pause and restarts only on a fresh attempt',()=>{
  const {ui,audio,text}=missionUi();ui.startMission(0);
  const shown=new Set<string>();
  for(let tick=0;tick<420;tick++){
    ui.update(undefined,undefined,tick/60,true,false);
    if(!ui.element.hidden)shown.add(text());
    if(tick===60){
      for(let n=0;n<30;n++)ui.update(undefined,undefined,1,true,true);
      expect(text()).toBe(observerMissionDialogue['zh-TW'][0]);
      expect(audio.syncRadio.mock.lastCall).toEqual(['zh-TW',.8,true,6.2,'missionIntro']);
    }
  }
  expect([...shown]).toEqual(observerMissionDialogue['zh-TW']);
  expect(audio.play.mock.calls).toEqual([['radioOpen'],['radioClose']]);
  expect(ui.element.hidden).toBe(true);
  for(let tick=0;tick<180;tick++)ui.update(undefined,undefined,tick/60,true,false);
  expect(ui.element.hidden).toBe(true);expect(audio.play).toHaveBeenCalledTimes(2);
  ui.startMission(0);for(let tick=0;tick<60;tick++)ui.update(undefined,undefined,tick/60,true,false);
  expect(audio.play).toHaveBeenCalledTimes(3);expect(ui.element.hidden).toBe(false);ui.dispose();
});
it('restores mid-intro as Chinese subtitles without repeated speech',()=>{
  const {ui,audio,text}=missionUi();ui.startMission(0);ui.update(undefined,undefined,2.5,true,false);
  expect(ui.element.hidden).toBe(false);expect(audio.play).not.toHaveBeenCalled();
  expect(audio.syncRadio.mock.lastCall).toEqual(['zh-TW',null,false,6.2,'missionIntro']);
  expect(text()).toBe(observerMissionDialogue['zh-TW'][1]);
  ui.reset();ui.update(undefined,undefined,3,true,false);expect(ui.element.hidden).toBe(true);
  ui.startMission(10);ui.update(undefined,undefined,10,true,false);expect(ui.element.hidden).toBe(true);
  ui.startMission(0);for(let tick=0;tick<20;tick++)ui.update(undefined,undefined,tick/60,true,false);
  ui.update(undefined,undefined,.35,false,false);expect(ui.element.hidden).toBe(true);ui.dispose();
});
it('keeps the opening syllable when a render frame crosses the cue and resumes from that same voice clock',()=>{
  const {ui,audio}=missionUi();ui.startMission(0);
  ui.update(undefined,undefined,.1,true,false);ui.update(undefined,undefined,.3,true,false);
  expect(audio.syncRadio.mock.lastCall?.[1]).toBe(0);
  ui.update(undefined,undefined,.35,true,true);
  expect(audio.syncRadio.mock.lastCall?.[1]).toBeCloseTo(.05);
  ui.update(undefined,undefined,.35,true,false);
  expect(audio.syncRadio.mock.lastCall?.[1]).toBeCloseTo(.05);ui.dispose();
});
it('keeps mission and naval recordings distinct, cancels delayed old dialogue and caches each recording once',async()=>{
  const {context,nodes}=audioHarness();let resolve!: (b:AudioBuffer)=>void;
  const loader=vi.fn((url:string)=>url.includes('mission_intro')
    ?new Promise<AudioBuffer>(r=>resolve=r):Promise.resolve({duration:5.407} as AudioBuffer));
  const voice=new ObserverVoice(context,{} as AudioNode,observerVoiceAssets,loader);
  voice.sync('zh-TW',0,false,6.2,'missionIntro');
  voice.sync('zh-TW',0,false,7.2,'destroyer');await Promise.resolve();await Promise.resolve();
  expect(nodes).toHaveLength(1);resolve({duration:5.64} as AudioBuffer);await Promise.resolve();await Promise.resolve();
  expect(nodes).toHaveLength(1);
  voice.sync('zh-TW',1,false,6.2,'missionIntro');await Promise.resolve();
  expect(nodes[0].stop).toHaveBeenCalledOnce();expect(nodes[1].start).toHaveBeenCalledWith(0,1);
  voice.sync('en',1,false,6.2,'missionIntro');expect(nodes[1].stop).toHaveBeenCalledOnce();
  voice.reset();voice.sync('zh-TW',null,false,6.2,'missionIntro');expect(loader).toHaveBeenCalledTimes(2);voice.dispose();
});
it.each(['en-US','zh-CN','ja','zh-TW'])('ignores %s browser language and saved English without creating a selector', browserLocale => {
  vi.stubGlobal('document',{createElement:()=>new ElementStub()});
  const getItem=vi.fn(()=> 'en'),setItem=vi.fn();
  vi.stubGlobal('navigator',{languages:[browserLocale]});
  vi.stubGlobal('window',{localStorage:{getItem,setItem}});
  const audio={play:vi.fn(),syncRadio:vi.fn(),prepareRadio:vi.fn(()=> 'ready' as const)}, host=new ElementStub(), ui=new FieldObserver(host as unknown as HTMLElement,audio,readyPortraits());
  for(let tick=0;tick<120;tick++)ui.update(state,config,tick/60,true,false);
  expect(ui.element.hidden).toBe(false);expect((ui.element as unknown as ElementStub).children[1].textContent).toBe(observerDialogue['zh-TW']);
  expect(host.children).toEqual([ui.element]);expect('selector' in ui).toBe(false);
  expect(getItem).not.toHaveBeenCalled();expect(setItem).not.toHaveBeenCalled();
  expect(audio.play).toHaveBeenCalledExactlyOnceWith('radioOpen');
  ui.update(state,config,119/60,true,true);expect(audio.syncRadio.mock.lastCall?.[2]).toBe(true);
  ui.reset();expect(ui.element.hidden).toBe(true);expect(audio.syncRadio.mock.lastCall).toEqual(['zh-TW',null,false]);
  ui.startMission(0);for(let tick=0;tick<60;tick++)ui.update(undefined,undefined,tick/60,true,false);
  expect((ui.element as unknown as ElementStub).children[1].textContent).toBe(observerMissionDialogue['zh-TW'][0]);
  expect(audio.syncRadio.mock.calls.every(call=>call[0]==='zh-TW')).toBe(true);ui.dispose();
});
