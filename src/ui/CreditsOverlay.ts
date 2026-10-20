import { publicAssetUrl } from '../core/publicAssetUrl';

const people = [
  ['遊戲製作', '疾如風', 'art/observer/neutral.webp'],
  ['音樂', '阿弘', 'art/victory/commander-soldier.webp'],
  ['測試、點子', '阿翔、小楷甯', 'art/observer/alert.webp'],
  ['協作', 'Julia、扣碟子', 'art/victory/commander-soldier.webp'],
] as const;

/** Idle-only presentation: owns no game clock, checkpoint or shared audio state. */
export class CreditsOverlay {
  readonly button = document.createElement('button');
  private readonly dialog = document.createElement('dialog');
  private readonly back = document.createElement('button');
  private music: HTMLAudioElement | null = null;
  private readonly open = (): void => {
    if (this.dialog.open) return;
    this.dialog.showModal();
    this.back.focus();
    // Call play synchronously inside the owner's button gesture. Denial stays silent and usable.
    this.music = new Audio(publicAssetUrl('audio/stage1-complete.mp3'));
    this.music.loop = true; this.music.volume = .45;
    void this.music.play().catch(() => {});
  };
  private readonly stopMusic = (): void => {
    if (!this.music) return;
    this.music.pause();
    this.music.removeAttribute('src'); this.music.load(); this.music = null;
  };
  private readonly close = (): void => { this.stopMusic(); this.dialog.close(); this.button.focus(); };
  private readonly visibility = (): void => { if (document.hidden) this.stopMusic(); };

  constructor(viewport: HTMLElement) {
    this.button.type = this.back.type = 'button';
    this.button.className = 'credits-entry'; this.button.textContent = '製作名單';
    this.back.className = 'credits-back'; this.back.textContent = '返回';
    this.dialog.className = 'credits-overlay'; this.dialog.lang = 'zh-Hant';
    this.dialog.setAttribute('aria-labelledby', 'credits-title');
    const header = document.createElement('header'), brand = document.createElement('small'), title = document.createElement('h1');
    brand.textContent = 'TOPWAR'; title.textContent = '製作名單'; title.id = 'credits-title';
    header.append(brand, title);
    const cast = document.createElement('div'); cast.className = 'credits-cast';
    for (const [role, name, asset] of people) {
      const row = document.createElement('section'), label = document.createElement('h2'), person = document.createElement('p'), image = document.createElement('img');
      label.textContent = role; person.textContent = name;
      image.src = publicAssetUrl(asset); image.alt = ''; image.draggable = false;
      image.className = asset.includes('victory') ? 'credits-duo' : 'credits-portrait';
      row.append(image, label, person); cast.append(row);
    }
    this.dialog.append(header, cast, this.back); viewport.append(this.button, this.dialog);
    this.button.addEventListener('click', this.open); this.back.addEventListener('click', this.close);
    this.dialog.addEventListener('close', this.stopMusic);
    document.addEventListener('visibilitychange', this.visibility);
  }
  dispose(): void {
    this.stopMusic();
    if (this.dialog.open) this.dialog.close();
    this.button.removeEventListener('click', this.open); this.back.removeEventListener('click', this.close);
    this.dialog.removeEventListener('close', this.stopMusic); document.removeEventListener('visibilitychange', this.visibility);
    this.button.remove(); this.dialog.remove();
  }
}
