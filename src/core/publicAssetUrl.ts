export function publicAssetUrl(path: string, baseUrl = import.meta.env.BASE_URL): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
