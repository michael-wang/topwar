export function openingReviewEnabled(): boolean {
  return import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location?.search).get('opening-review') === '1';
}
