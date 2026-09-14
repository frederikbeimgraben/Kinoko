import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { InfiniteListComponent } from './infinite-list.component';

/** jsdom kennt keinen IntersectionObserver. Der Test steuert ihn von Hand. */
class ObserverStub {
  static instances: ObserverStub[] = [];
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    ObserverStub.instances.push(this);
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

describe('InfiniteListComponent', () => {
  beforeEach(() => {
    ObserverStub.instances = [];
    vi.stubGlobal('IntersectionObserver', ObserverStub);
  });

  it('fordert die nächste Seite an, wenn der Fühler sichtbar wird', async () => {
    const { fixture } = await render(InfiniteListComponent, { inputs: { pageSize: 40, hasMore: true } });
    let calls = 0;
    fixture.componentInstance.more.subscribe(() => (calls += 1));
    await fixture.whenStable();

    ObserverStub.instances[0].trigger(true);

    expect(calls).toBe(1);
  });

  it('fordert nichts an, wenn nichts mehr folgt', async () => {
    const { fixture } = await render(InfiniteListComponent, { inputs: { pageSize: 40, hasMore: false } });
    let calls = 0;
    fixture.componentInstance.more.subscribe(() => (calls += 1));
    await fixture.whenStable();

    ObserverStub.instances[0].trigger(true);

    expect(calls).toBe(0);
  });

  it('fordert nichts an, während eine Seite lädt', async () => {
    const { fixture } = await render(InfiniteListComponent, {
      inputs: { pageSize: 40, hasMore: true, pending: true },
    });
    let calls = 0;
    fixture.componentInstance.more.subscribe(() => (calls += 1));
    await fixture.whenStable();

    ObserverStub.instances[0].trigger(true);

    expect(calls).toBe(0);
  });

  it('zeigt ein Skelett, während eine Seite lädt', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container, detectChanges } = await render(InfiniteListComponent, {
      inputs: { pageSize: 50, pending: true },
    });
    await vi.advanceTimersByTimeAsync(300);
    detectChanges();

    expect(container.querySelectorAll('.skeleton__bar--row').length).toBe(3);
    vi.useRealTimers();
  });

  it('kappt das Skelett auf höchstens drei Zeilen', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { container, detectChanges } = await render(InfiniteListComponent, {
      inputs: { pageSize: 40, pending: true },
    });
    await vi.advanceTimersByTimeAsync(300);
    detectChanges();

    expect(container.querySelectorAll('.skeleton__bar--row').length).toBe(3);
    vi.useRealTimers();
  });

  it('bleibt ohne Befund', async () => {
    const { container } = await render(InfiniteListComponent, { inputs: { pageSize: 40 } });

    await noViolations(container);
  });
});
