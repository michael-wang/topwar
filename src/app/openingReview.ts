export function openingReviewEnabled(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location?.search).get('opening-review') === '1';
}
