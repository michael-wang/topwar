import { SessionRecovery } from './SessionRecovery';

type CompletedStages = 0 | 1 | 2 | 3 | 4;
let current = { text: '正在讀取遊戲設定…', completed: 0 as CompletedStages };

export function startupStatus(text: string, completed: CompletedStages): void {
  current = { text, completed };
  const cover = document.querySelector('#session-recovery-loading.boot-cover');
  if (!cover) return; // Never replace the protected recovery choice with loading status.
  const status = cover.querySelector('[data-boot-status]');
  if (status) status.textContent = text;
  const bar = cover.querySelector<HTMLProgressElement>('[data-boot-progress]');
  if (bar) { bar.value = completed; bar.setAttribute('aria-valuetext', `已完成 ${completed} / 4 個準備階段`); }
  const step = cover.querySelector('[data-boot-step]');
  if (step) step.textContent = `已完成 ${completed} / 4 階段`;
}

/** A recovery selection rejoins the same real milestones, including work already completed. */
export function startupLoading(host: HTMLElement, resume: boolean): void {
  const cover = SessionRecovery.loading(host); cover.className = 'session-recovery boot-cover';
  cover.setAttribute('aria-label', resume ? '恢復遊戲' : '準備遊戲');
  const card = document.createElement('div'), title = document.createElement('strong'), status = document.createElement('p');
  title.textContent = 'TOPWAR'; status.setAttribute('data-boot-status', '');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
  const bar = document.createElement('progress'); bar.setAttribute('data-boot-progress', '');
  bar.max = 4; bar.setAttribute('aria-label', '載入準備階段');
  const step = document.createElement('small'); step.setAttribute('data-boot-step', '');
  const hint = document.createElement('small');
  hint.textContent = resume ? '正在恢復遊戲… 準備完成後保持暫停。' : '正在開始遊戲… 準備完成後點一下即可遊玩。';
  card.append(title, status, bar, step, hint); cover.replaceChildren(card);
  startupStatus(current.text, current.completed);
}

/** Let completed milestones paint before the next synchronous GPU/mesh preparation. */
export function startupPaint(): Promise<void> {
  return new Promise(resolve => {
    let painted: ReturnType<typeof setTimeout> | undefined;
    const finish = (): void => { clearTimeout(deadline); clearTimeout(painted); cancelAnimationFrame(frame); resolve(); };
    const deadline = setTimeout(finish, 100); // Background tabs must not wait indefinitely for RAF.
    const frame = requestAnimationFrame(() => { painted = setTimeout(finish, 0); });
  });
}

// A stalled request must also release a chosen Continue/New Game loading state.
export async function startupResource<T>(pending: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Startup resource timed out')), 30000);
  });
  try { return await Promise.race([pending, deadline]); }
  finally { clearTimeout(timer!); }
}

export function startupFailure(host: HTMLElement): void {
  document.dispatchEvent(new Event('topwar:boot-ready'));
  const cover = SessionRecovery.loading(host);
  cover.className = 'boot-cover'; cover.setAttribute('aria-label', '載入遊戲失敗'); cover.setAttribute('aria-busy', 'false');
  const card = document.createElement('div'), title = document.createElement('strong'), status = document.createElement('p');
  title.textContent = 'TOPWAR'; status.textContent = '暫時無法載入遊戲'; status.setAttribute('role', 'alert');
  const hint = document.createElement('small'); hint.textContent = '請檢查連線後重新載入。已儲存的進度會保留。';
  const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重新載入';
  retry.addEventListener('click', () => { if (retry.disabled) return; retry.disabled = true; retry.textContent = '正在重新載入…'; location.reload(); });
  card.append(title, status, hint, retry); cover.replaceChildren(card); retry.focus();
}
