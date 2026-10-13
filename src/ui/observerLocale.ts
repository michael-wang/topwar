export type ObserverLocale = 'zh-TW' | 'en';
// Closed playtest policy. Keep the bilingual resources/helpers for later testing.
export const FIELD_OBSERVER_LOCALE: ObserverLocale = 'zh-TW';
export type ObserverMessage = 'destroyer' | 'missionIntro' | 'tankBoss' | 'victory' | 'giant' | 'airSupport';
export const observerSupportDialogue: Record<'giant' | 'airSupport', Record<ObserverLocale, string>> = {
  giant: { 'zh-TW': '注意！敵軍巨型機械兵出現了！別讓它靠近防線！', en: 'Enemy giant machine spotted! Keep it away from the defense line!' },
  airSupport: { 'zh-TW': '撐住！我替你們爭取到空中支援了！全員掩護！', en: 'Hold on! Air support is on its way! Take cover!' },
};
export const observerTankDialogue: Record<ObserverLocale, string> = {
  'zh-TW': '警告！發現敵軍超重型坦克！正朝我方防線推進！',
  en: 'Warning! Enemy super-heavy tank spotted! Advancing toward our defense line!',
};
export const observerMissionDialogue: Record<ObserverLocale, readonly string[]> = {
  'zh-TW': ['這裡是海防指揮部。', '其他防線已經失守，灘頭只剩你們這支部隊。', '這裡是港口最後一道防線。', '無論如何，守住它！'],
  en: ['Coastal Defense Command here.', 'The other lines have fallen. Yours is the last unit on the beachhead.', 'This is the harbor’s last line of defense.', 'Hold it at all costs!'],
};
export const observerVictoryDialogue: Record<ObserverLocale, readonly string[]> = {
  'zh-TW': ['做得好！敵軍超重型坦克已被摧毀！', '你們守住了灘頭。', '各位，辛苦了……', '我以你們為榮！'],
  en: ['Well done! The enemy super-heavy tank is destroyed!', 'You held the beachhead.', 'Thank you, everyone…', 'I am proud of you!'],
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
