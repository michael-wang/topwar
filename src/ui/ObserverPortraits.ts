import { publicAssetUrl } from '../core/publicAssetUrl';

export type ObserverExpression = 'neutral' | 'alert';
export interface PreparedObserverPortraits {
  readonly readiness: 'pending' | 'ready' | 'unavailable';
  get(expression: ObserverExpression): HTMLImageElement | null;
}

/** Decode once, then insert the actual prepared element; never swap a visible src. */
export class ObserverPortraits implements PreparedObserverPortraits {
  private readonly images = new Map<ObserverExpression, HTMLImageElement>();
  private pending = 2;
  private disposed = false;
  private readonly cancel = new Set<() => void>();
  constructor() {
    for (const expression of ['neutral', 'alert'] as const) {
      const image = new Image(110, 110);
      image.alt = ''; image.decoding = 'async';
      let settled = false;
      const finish = (ready: boolean) => {
        if (settled) return;
        settled = true; clearTimeout(timeout); this.cancel.delete(cancel);
        this.pending--;
        if (ready && !this.disposed) this.images.set(expression, image);
        else image.removeAttribute('src');
      };
      const cancel = () => finish(false);
      const timeout = setTimeout(cancel, 8000);
      this.cancel.add(cancel);
      image.src = publicAssetUrl(`art/observer/${expression}.webp`);
      void image.decode().then(() => finish(image.naturalWidth > 0), cancel);
    }
  }
  get readiness(): 'pending' | 'ready' | 'unavailable' {
    return this.images.size ? 'ready' : this.pending ? 'pending' : 'unavailable';
  }
  get(expression: ObserverExpression): HTMLImageElement | null {
    return this.images.get(expression) ?? this.images.get('neutral') ?? this.images.get('alert') ?? null;
  }
  dispose(): void {
    this.disposed = true;
    for (const cancel of this.cancel) cancel();
    this.images.clear();
  }
}
