export function formatBuildLabel(version: string, shortSha: string): string {
  const safeVersion = version.trim() || 'unknown';
  const safeSha = /^[0-9a-f]{7,40}$/i.test(shortSha.trim()) ? shortSha.trim().slice(0, 7) : 'unknown';
  return `v${safeVersion} · ${safeSha}`;
}

export function mountBuildLabel(viewport: HTMLElement, version: string, shortSha: string): void {
  const label = document.createElement('span');
  label.className = 'build-label';
  label.textContent = formatBuildLabel(version, shortSha);
  viewport.append(label);
}
