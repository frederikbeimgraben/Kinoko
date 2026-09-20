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

  it('zeigt die Art rows als Zeilen mit Kreis und zwei Strichen', async () => {
    const { container, detectChanges } = await render(SkeletonComponent, {
      inputs: { kind: 'rows', count: 3 },
    });
    await vi.advanceTimersByTimeAsync(300);
    detectChanges();

    expect(container.querySelectorAll('.skeleton__row')).toHaveLength(3);
    expect(container.querySelectorAll('.skeleton__row-icon')).toHaveLength(3);
    expect(container.querySelectorAll('.skeleton__row-line')).toHaveLength(6);
  });

  it('zeigt die Art tiles als Raster', async () => {
    const { container, detectChanges } = await render(SkeletonComponent, {
      inputs: { kind: 'tiles', count: 6 },
    });
    await vi.advanceTimersByTimeAsync(300);
    detectChanges();

    expect(container.querySelector('.skeleton__tiles')).toBeInTheDocument();
    expect(container.querySelectorAll('.skeleton__tile')).toHaveLength(6);
  });

  it('bleibt vor Hilfsmitteln verborgen', async () => {
    const { container, fixture } = await render(SkeletonComponent, { inputs: { kind: 'row' } });

    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();

    expect(fixture.nativeElement as HTMLElement).toHaveAttribute('aria-hidden', 'true');
    await noViolations(container);
  });
});
