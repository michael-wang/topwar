export type ObserverLocale = 'zh-TW' | 'en';
export type ObserverMessage = 'destroyer' | 'missionIntro';
export const observerMissionDialogue: Record<ObserverLocale, readonly string[]> = {
  'zh-TW': ['這裡是觀測官。', '敵軍正朝港口逼近！', '請守住防線。完畢！'],
  en: ['Field Observer here.', 'Enemy forces are approaching the harbor!', 'Hold the line. Over.'],
};
export const observerDialogue: Record<ObserverLocale, string> = {
  'zh-TW': '注意，左前方發現敵方驅逐艦！準備閃避砲擊。完畢！',
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
