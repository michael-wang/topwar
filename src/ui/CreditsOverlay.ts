import { publicAssetUrl } from '../core/publicAssetUrl';

const people = [
  ['音樂', '阿弘', 'art/credits/heavy-front-walk.webp', 'music'],
  ['測試', '阿翔', 'art/credits/player-front-walk.webp', 'test-xiang'],
  ['點子、測試', '小楷甯', 'art/credits/commander-front-walk.webp', 'test-kai'],
  ['協作', 'Julia、扣碟子', 'art/credits/grunt-front-walk.webp', 'collab'],
  ['遊戲製作', '疾如風', 'art/credits/giant-front-walk.webp', 'producer'],
] as const;

/** Idle-only presentation: owns no game clock, checkpoint or shared audio state. */
export class CreditsOverlay {
  readonly button = document.createElement('button');
  private readonly dialog = document.createElement('dialog');
  private readonly back = document.createElement('button');
  private music: HTMLAudioElement | null = null;
  private restoringModal = false;
  private readonly open = (): void => {
    if (this.dialog.open) return;
    this.dialog.showModal();
    this.back.focus();
    // Call play synchronously inside the owner's button gesture. Denial stays silent and usable.
    this.music = new Audio(publicAssetUrl('audio/stage1-complete.mp3'));
    this.music.loop = true; this.music.volume = .225;
    void this.music.play().catch(() => {});
    // Fullscreen may consume activation: request only after audio, without awaiting.
    try { this.requestFullscreen(); } catch { /* Optional presentation; Credits stays usable. */ }
  };
  private readonly stopMusic = (): void => {
    if (!this.music) return;
    this.music.pause();
    this.music.removeAttribute('src'); this.music.load(); this.music = null;
  };
  private readonly close = (): void => { this.stopMusic(); this.dialog.close(); this.button.focus(); };
  private readonly closed = (): void => { if (!this.restoringModal && !this.dialog.open) this.stopMusic(); };
  private readonly fullscreenChanged = (): void => {
    if (!this.dialog.open || !document.fullscreenElement?.contains(this.dialog)) return;
    // The fullscreen ancestor enters the top layer above an already-open dialog.
    // Reopen the same modal above it without treating this as a music dismissal.
    this.restoringModal = true;
    try { this.dialog.close(); this.dialog.showModal(); this.back.focus(); }
    finally { this.restoringModal = false; }
  };
  private readonly visibility = (): void => { if (document.hidden) this.stopMusic(); };

  constructor(viewport: HTMLElement, private readonly requestFullscreen: () => void = () => {}) {
    this.button.type = this.back.type = 'button';
    this.button.className = 'credits-entry'; this.button.textContent = '製作名單';
    this.back.className = 'credits-back'; this.back.textContent = '返回';
    this.dialog.className = 'credits-overlay'; this.dialog.lang = 'zh-Hant';
    this.dialog.setAttribute('aria-labelledby', 'credits-title');
    const header = document.createElement('header'), title = document.createElement('h1');
    title.textContent = 'CREDITS'; title.id = 'credits-title';
    header.append(title);
    const cast = document.createElement('div'); cast.className = 'credits-cast';
    for (const [role, name, asset, section] of people) {
      const row = document.createElement('section'), label = document.createElement('h2'), person = document.createElement('p'), image = document.createElement('span');
      label.textContent = role; person.textContent = name;
      row.className = `credits-${section}`;
      image.className = 'credits-sprite'; image.setAttribute('role', 'img');
      image.setAttribute('aria-label', section === 'producer' ? 'GIANT' : section === 'music' ? 'HEAVY' : section === 'collab' ? 'GRUNT' : section === 'test-kai' ? '女性指揮官' : '我方士兵');
      image.style.backgroundImage = `url("${publicAssetUrl(asset)}")`;
      row.append(image, person, label); cast.append(row);
    }
    this.dialog.append(header, cast, this.back); viewport.append(this.button, this.dialog);
    this.button.addEventListener('click', this.open); this.back.addEventListener('click', this.close);
    this.dialog.addEventListener('close', this.closed);
    document.addEventListener('fullscreenchange', this.fullscreenChanged);
    document.addEventListener('visibilitychange', this.visibility);
  }
  dispose(): void {
    this.stopMusic();
    if (this.dialog.open) this.dialog.close();
    this.button.removeEventListener('click', this.open); this.back.removeEventListener('click', this.close);
    this.dialog.removeEventListener('close', this.closed); document.removeEventListener('visibilitychange', this.visibility);
    document.removeEventListener('fullscreenchange', this.fullscreenChanged);
    this.button.remove(); this.dialog.remove();
  }
}
