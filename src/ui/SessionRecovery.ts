export class SessionRecovery {
  private readonly element = document.createElement('div');
  constructor(host: HTMLElement, valid: boolean, choose: (continueGame: boolean) => void) {
    this.element.className = 'session-recovery';
    this.element.lang = 'zh-Hant';
    this.element.setAttribute('role', 'dialog'); this.element.setAttribute('aria-modal', 'true');
    this.element.setAttribute('aria-label', '遊戲進度');
    const card = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = valid ? '已保留上次遊戲進度' : '無法讀取上次進度';
    card.append(title);
    for (const resume of valid ? [true, false] : [false]) {
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = resume ? '繼續上次遊戲' : '重新開始';
      button.addEventListener('click', () => { choose(resume); this.dispose(); });
      card.append(button);
    }
    this.element.append(card); host.append(this.element);
  }
  dispose(): void { this.element.remove(); }
}
