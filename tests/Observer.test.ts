import { afterEach, expect, it, vi } from 'vitest';
// @ts-expect-error Vitest runs in Node; project typecheck exposes browser types only.
import { readFileSync } from 'node:fs';
// @ts-expect-error Vitest runs in Node; project typecheck exposes browser types only.
import { createHash } from 'node:crypto';
import { loadObserverLocale, selectObserverLocale, saveObserverLocale, observerDialogue } from '../src/ui/observerLocale';
import { ObserverTimeline } from '../src/presentation/ObserverTimeline';
import { ObserverVoice, observerVoiceAssets } from '../src/audio/ObserverVoice';
import { destroyerDefaults as config } from '../src/config/destroyerConfig';
import { FieldObserver } from '../src/ui/FieldObserver';
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
  voice.sync('zh-TW',null,false);await Promise.resolve();expect(loader).toHaveBeenCalledOnce();expect(nodes).toHaveLength(0);
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
  setAttribute(key:string,value:string){this.attrs[key]=value;}
}
it('updates matching subtitles and locale without restarting combat; Retry hides the panel and cancels voice', () => {
  const stored = new Map<string,string>();
  vi.stubGlobal('document',{createElement:()=>new ElementStub()});
  vi.stubGlobal('navigator',{languages:['zh-TW']});
  vi.stubGlobal('window',{localStorage:{getItem:(k:string)=>stored.get(k),setItem:(k:string,v:string)=>stored.set(k,v)}});
  const audio={play:vi.fn(),syncRadio:vi.fn()}, host=new ElementStub(), ui=new FieldObserver(host as unknown as HTMLElement,audio);
  for(let tick=0;tick<120;tick++)ui.update(state,config,tick/60,true,false);
  expect(ui.element.hidden).toBe(false);expect((ui.element as unknown as ElementStub).children[1].textContent).toBe(observerDialogue['zh-TW']);
  const en=(ui.selector as unknown as ElementStub).children[1];en.dispatchEvent(new Event('click'));
  expect((ui.element as unknown as ElementStub).children[1].textContent).toBe(observerDialogue.en);
  expect([...stored.values()]).toEqual(['en']);expect(audio.play).toHaveBeenCalledExactlyOnceWith('radioOpen');
  ui.update(state,config,119/60,true,true);expect(audio.syncRadio.mock.lastCall?.[2]).toBe(true);
  ui.reset();expect(ui.element.hidden).toBe(true);expect(audio.syncRadio.mock.lastCall).toEqual(['en',null,false]);ui.dispose();
});
