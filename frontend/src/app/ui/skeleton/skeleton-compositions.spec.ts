import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { MapPanelSkeletonComponent } from './map-panel-skeleton.component';
import { RowGroupSkeletonComponent } from './row-group-skeleton.component';
import { SpeciesPageSkeletonComponent } from './species-page-skeleton.component';

@Component({
  imports: [SpeciesPageSkeletonComponent],
  template: `<app-species-page-skeleton heroHeight="210px"
    ><button lead type="button">back</button></app-species-page-skeleton
  >`,
})
class SpeciesPageHostComponent {}

describe('skeleton compositions', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the three blocks of the map panel', async () => {
    const { container, detectChanges } = await render(MapPanelSkeletonComponent);
    await vi.advanceTimersByTimeAsync(300);
    detectChanges();

    const heights = [...container.querySelectorAll<HTMLElement>('.skeleton__block')].map(
      (block) => block.style.blockSize,
    );
    expect(heights).toEqual(['36px', '64px', '48px']);
  });

  it('shows a group of row cards with a label', async () => {
    const { container, detectChanges } = await render(RowGroupSkeletonComponent, {
      inputs: { count: 2, label: true, trail: 'chevron' },
    });
    await vi.advanceTimersByTimeAsync(300);
    detectChanges();

    expect(container.querySelectorAll('.skeleton__row--row')).toHaveLength(2);
    expect(container.querySelectorAll('.skeleton__label')).toHaveLength(1);
    expect(container.querySelectorAll('.skeleton__chevron')).toHaveLength(2);
  });

  it('shows the species page with the projected back button, the hero and three sections', async () => {
    const { container, detectChanges } = await render(SpeciesPageHostComponent);
    await vi.advanceTimersByTimeAsync(300);
    detectChanges();

    expect(container.querySelector('.page__bar button')).toHaveTextContent('back');
    expect(container.querySelector<HTMLElement>('.skeleton__block')?.style.blockSize).toBe('210px');
    expect(container.querySelectorAll('.skeleton__section')).toHaveLength(3);
    expect(container.querySelectorAll('.skeleton__row--row')).toHaveLength(9);
    await noViolations(container);
  });
});
