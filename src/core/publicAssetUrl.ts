export function publicAssetUrl(path: string, baseUrl = import.meta.env.BASE_URL): string {
  const url = `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
  if (!import.meta.env.PROD) return url;

  // Build-emitted filenames bind each URL to its bytes across unrelated commits.
  const fragmentAt = url.indexOf('#');
  const fragment = fragmentAt < 0 ? '' : url.slice(fragmentAt);
  const resource = fragmentAt < 0 ? url : url.slice(0, fragmentAt);
  const queryAt = resource.indexOf('?');
  const pathname = queryAt < 0 ? resource : resource.slice(0, queryAt);
  const relative = path.replace(/^\/+/, '').split(/[?#]/)[0];
  const versioned = __TOPWAR_PUBLIC_ASSETS__[relative];
  if (!versioned) throw new Error(`Public asset is missing from the build manifest: ${relative}`);
  const query = new URLSearchParams(queryAt < 0 ? '' : resource.slice(queryAt + 1));
  query.delete('v');
  const filename = pathname.slice(0, pathname.length - relative.length) + versioned;
  return `${filename}${query.size ? `?${query}` : ''}${fragment}`;
}
