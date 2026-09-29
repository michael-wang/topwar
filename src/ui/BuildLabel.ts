export function formatBuildLabel(version: string, shortSha: string): string {
  const safeVersion = version.trim() || 'unknown';
  const safeSha = /^[0-9a-f]{7,40}$/i.test(shortSha.trim()) ? shortSha.trim().slice(0, 7) : 'unknown';
  return `v${safeVersion} · ${safeSha}`;
}

export function mountBuildLabel(viewport: HTMLElement, version: string, shortSha: string): HTMLElement {
  const label = document.createElement('span');
  label.className = 'build-label';
  label.textContent = formatBuildLabel(version, shortSha);
  viewport.append(label);
  return label;
}

type DevBuildInfoLoader = (url: string, options: { cache: 'no-store' }) =>
  Promise<Pick<Response, 'ok' | 'json'>>;

export async function refreshDevBuildLabel(label: HTMLElement, version: string,
  injectedSha: string, load: DevBuildInfoLoader = fetch): Promise<void> {
  let sha = injectedSha;
  try {
    const response = await load('/__topwar/build-info', { cache: 'no-store' });
    if (response.ok) {
      const data: unknown = await response.json();
      const candidate = (data as { shortSha?: unknown } | null)?.shortSha;
      if (typeof candidate === 'string' && /^[0-9a-f]{7,40}$/i.test(candidate)) sha = candidate;
    }
  } catch { /* Keep the injected build SHA if the local endpoint is unavailable. */ }
  label.textContent = formatBuildLabel(version, sha);
}
