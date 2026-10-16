import { SessionRecovery } from './SessionRecovery';

export function startupStatus(text: string): void {
  const status = document.querySelector('#session-recovery-loading.boot-cover [data-boot-status]');
  if (status) status.textContent = text;
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
