/** jsdom kennt keinen IntersectionObserver. Der Test steuert ihn von Hand. */
export class IntersectionObserverStub {
  static instances: IntersectionObserverStub[] = [];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    IntersectionObserverStub.instances.push(this);
  }

  observe(): void {
    // Das Ziel selbst braucht der Test nicht, nur die Auslösung danach.
  }

  unobserve(): void {
    // Der Stummel braucht keine Buchführung über das Ziel.
  }

  disconnect(): void {
    // Der Stummel räumt nichts auf, der Test endet vorher.
  }

  trigger(isIntersecting: boolean): void {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

/** Setzt den Stummel als IntersectionObserver ein und leert seine Liste. */
export function stubIntersectionObserver(): void {
  IntersectionObserverStub.instances = [];
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
}
