import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { SkeletonComponent, type SkeletonKind } from './skeleton.component';

describe('SkeletonComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('zeigt nichts vor 300 ms', async () => {
    const { container } = await render(SkeletonComponent, { inputs: { kind: 'row' } });

    expect(container.querySelectorAll('.skeleton__bar').length).toBe(0);
  });

  it('zeigt die Balken nach 300 ms', async () => {
    const { container, detectChanges } = await render(SkeletonComponent, {
      inputs: { kind: 'row', count: 3 },
    });

    await vi.advanceTimersByTimeAsync(300);
    detectChanges();

    expect(container.querySelectorAll('.skeleton__bar--row').length).toBe(3);
  });

  it('kennt jede Art', async () => {
    const kinds: SkeletonKind[] = ['row', 'tile', 'card', 'block'];
    for (const kind of kinds) {
      TestBed.resetTestingModule();
      const { container, detectChanges } = await render(SkeletonComponent, { inputs: { kind } });
      await vi.advanceTimersByTimeAsync(300);
      detectChanges();

      expect(container.querySelector(`.skeleton__bar--${kind}`)).not.toBeNull();
    }
  });

  it('bleibt vor Hilfsmitteln verborgen', async () => {
    const { container, fixture } = await render(SkeletonComponent, { inputs: { kind: 'row' } });

    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();

    expect(fixture.nativeElement as HTMLElement).toHaveAttribute('aria-hidden', 'true');
    await noViolations(container);
  });
});
