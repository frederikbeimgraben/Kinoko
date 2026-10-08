/** jsdom has no IntersectionObserver. The test triggers it by hand. */
export class IntersectionObserverStub {
  static instances: IntersectionObserverStub[] = [];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    IntersectionObserverStub.instances.push(this);
  }

  observe(): void {
    // The test does not need the target, only the trigger after it.
  }

  unobserve(): void {
    // The stub does not track targets.
  }

  disconnect(): void {
    // The stub has nothing to clean up.
  }

  trigger(isIntersecting: boolean): void {
    this.callback([{ isIntersecting } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
}

/** Installs the stub as IntersectionObserver and clears its instance list. */
export function stubIntersectionObserver(): void {
  IntersectionObserverStub.instances = [];
  vi.stubGlobal('IntersectionObserver', IntersectionObserverStub);
}
