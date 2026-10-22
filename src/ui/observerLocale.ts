export type ObserverLocale = 'zh-TW' | 'en';
// Closed playtest policy. Keep the bilingual resources/helpers for later testing.
export const FIELD_OBSERVER_LOCALE: ObserverLocale = 'zh-TW';
export type ObserverMessage = 'destroyer' | 'missionIntro' | 'tankBoss' | 'victory' | 'giant' | 'airSupport' | 'airSupportReady' | 'airSupportCalled';
export const observerSupportDialogue: Record<'giant', Record<ObserverLocale, string>> = {
  giant: { 'zh-TW': '注意！敵軍巨型機械兵出現了！別讓它靠近防線！', en: 'Enemy giant machine spotted! Keep it away from the defense line!' },
};
// Approved 6.766s recording: the sentence break is the silence at 2.6–3.1s.
export const airSupportTiming = { durationSeconds: 6.95, phraseAtSeconds: 3.05 };
// New manual E/F: Chrome-decoded approved recordings plus a .35s closing margin.
// The combined recording/timing above remains authoritative for historical automatic raids.
export const manualAirSupportTiming = { readyDurationSeconds: 4.059375, calledDurationSeconds: 3.824271 };
// Retained historical split metadata; current manual E/F files no longer seek these offsets.
export function airSupportVoiceSegment(message: ObserverMessage): { start: number; end: number } | undefined {
  if (message === 'airSupportReady') return { start: 0, end: airSupportTiming.phraseAtSeconds };
  if (message === 'airSupportCalled') return { start: airSupportTiming.phraseAtSeconds, end: airSupportTiming.durationSeconds };
}
export const observerAirSupportDialogue: Record<ObserverLocale, readonly string[]> = {
  'zh-TW': ['各位！我剛爭取到空中轟炸支援！', '轟炸機馬上抵達現場！注意！轟炸即將開始！！'],
  en: ['Everyone! I secured bomber support!', 'Bombers arriving! Attention! Bombing is about to begin!'],
};
export const observerManualAirSupportDialogue: Record<ObserverLocale, readonly string[]> = {
  'zh-TW': ['空中支援已經待命！隨時可以下令！', '轟炸編隊正在進場！準備進行打擊！'],
  en: observerAirSupportDialogue.en,
};
export const observerTankDialogue: Record<ObserverLocale, string> = {
  'zh-TW': '警告！發現敵軍超重型坦克！正朝我方防線推進！',
  en: 'Warning! Enemy super-heavy tank spotted! Advancing toward our defense line!',
};
export const observerMissionDialogue: Record<ObserverLocale, readonly string[]> = {
  'zh-TW': ['我是戰區指揮官。', '目前偵測到大批敵軍正從海上逼近。', '我會提供關鍵的情報與支援。', '讓我們一起守住這座港口！'],
  en: ['I am your Theater Commander.', 'Large enemy forces are approaching from the sea.', 'I will provide critical intelligence and support.', 'Let’s hold this harbor together!'],
};
export const observerVictoryDialogue: Record<ObserverLocale, readonly string[]> = {
  'zh-TW': ['做得好！敵軍超重型坦克已被摧毀！', '你們守住了灘頭。', '各位，辛苦了……', '我以你們為榮！'],
  en: ['Well done! The enemy super-heavy tank is destroyed!', 'You held the beachhead.', 'Thank you, everyone…', 'I am proud of you!'],
};
export const observerDialogue: Record<ObserverLocale, string> = {
  'zh-TW': '注意，左前方發現敵方驅逐艦！準備閃避砲擊',
  en: 'Enemy destroyer approaching from the left! Incoming naval fire. Over.',
};
export const OBSERVER_LOCALE_KEY = 'topwar.observer.locale';
export function selectObserverLocale(languages: readonly string[], saved?: string | null): ObserverLocale {
  if (saved === 'zh-TW' || saved === 'en') return saved;
  return /^zh-(?:TW|Hant|HK|MO)(?:-|$)/i.test(languages[0] ?? '') ? 'zh-TW' : 'en';
}
export function loadObserverLocale(languages: readonly string[], storage?: Pick<Storage, 'getItem'>): ObserverLocale {
  try { return selectObserverLocale(languages, storage?.getItem(OBSERVER_LOCALE_KEY)); }
  catch { return selectObserverLocale(languages); }
}
export function saveObserverLocale(locale: ObserverLocale, storage?: Pick<Storage, 'setItem'>): void {
  try { storage?.setItem(OBSERVER_LOCALE_KEY, locale); } catch { /* Settings are optional in private browsing. */ }
}
