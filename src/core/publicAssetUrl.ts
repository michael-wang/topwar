export function publicAssetUrl(path: string, baseUrl = import.meta.env.BASE_URL): string {
  const url = `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  if (!import.meta.env.PROD) return url;

  // Public files keep stable names: bind their cached bytes to the JS build.
  const fragmentAt = url.indexOf('#');
  const fragment = fragmentAt < 0 ? '' : url.slice(fragmentAt);
  const resource = fragmentAt < 0 ? url : url.slice(0, fragmentAt);
  const queryAt = resource.indexOf('?');
  const pathname = queryAt < 0 ? resource : resource.slice(0, queryAt);
  const query = new URLSearchParams(queryAt < 0 ? '' : resource.slice(queryAt + 1));
  query.set('v', __TOPWAR_SHA__);
  return `${pathname}?${query}${fragment}`;
}
