import { TestBed } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { SkeletonComponent, skeletonSections, type SkeletonKind } from './skeleton.component';

describe('SkeletonComponent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Renders the skeleton and waits for the 300 ms delay. */
  async function shown(inputs: Record<string, unknown>): Promise<HTMLElement> {
    const { container, detectChanges } = await render(SkeletonComponent, { inputs });
    await vi.advanceTimersByTimeAsync(300);
    detectChanges();
    return container;
  }

  it('shows nothing before 300 ms', async () => {
    const { container } = await render(SkeletonComponent, { inputs: { kind: 'rows' } });

    expect(container.querySelectorAll('.skel').length).toBe(0);
  });

  it('shows the kind rows as kit rows: a thumb and two lines', async () => {
    const container = await shown({ kind: 'rows', count: 3 });

    expect(container.querySelectorAll('.skeleton__row--plain')).toHaveLength(3);
    expect(container.querySelectorAll('.skeleton__lead--thumb')).toHaveLength(3);
    expect(container.querySelectorAll('.skeleton__line')).toHaveLength(6);
    const widths = [...container.querySelectorAll<HTMLElement>('.skeleton__line')].map(
      (line) => line.style.inlineSize,
    );
    expect(widths.slice(0, 4)).toEqual(['45%', '30%', '62%', '41%']);
  });

  it('knows each kind', async () => {
    const kinds: [SkeletonKind, string][] = [
      ['tiles', '.skeleton__tile'],
      ['block', '.skeleton__block'],
      ['line', '.skeleton__line'],
      ['map', '.skeleton__map'],
    ];
    for (const [kind, selector] of kinds) {
      TestBed.resetTestingModule();
      const container = await shown({ kind });

      expect(container.querySelector(selector)).not.toBeNull();
    }
  });

  it('puts the shimmer on each block but not on the map', async () => {
    const rows = await shown({ kind: 'rows', count: 2 });
    expect(rows.querySelectorAll('.skel:not(.motion-shimmer)')).toHaveLength(0);

    TestBed.resetTestingModule();
    const map = await shown({ kind: 'map' });
    expect(map.querySelector('.motion-shimmer')).toBeNull();
  });

  it('shows the kind tiles as a grid with the given columns and height', async () => {
    const container = await shown({ kind: 'tiles', count: 4, cols: 4, height: '72px' });

    expect(container.querySelector<HTMLElement>('.skeleton__tiles')?.style.gridTemplateColumns).toBe(
      'repeat(4, minmax(0, 1fr))',
    );
    const tiles = container.querySelectorAll<HTMLElement>('.skeleton__tile');
    expect(tiles).toHaveLength(4);
    expect(tiles[0].style.blockSize).toBe('72px');
  });

  it('gives a block its own height and radius', async () => {
    const container = await shown({ kind: 'block', height: '260px', radius: '28px' });

    const block = container.querySelector<HTMLElement>('.skeleton__block');
    expect(block?.style.blockSize).toBe('260px');
    expect(block?.style.borderRadius).toBe('28px');
  });

  it('shows row cards with a lead, a trail and labels', async () => {
    const container = await shown({
      kind: 'rows',
      count: 6,
      shape: 'row',
      lead: 'none',
      trail: 'value',
      lines: 1,
      labels: [0, 3],
    });

    expect(container.querySelectorAll('.skeleton__section')).toHaveLength(2);
    expect(container.querySelectorAll('.skeleton__label')).toHaveLength(2);
    expect(container.querySelectorAll('.skeleton__row--row')).toHaveLength(6);
    expect(container.querySelectorAll('.skeleton__value')).toHaveLength(6);
    expect(container.querySelectorAll('.skeleton__lead')).toHaveLength(0);
    expect(container.querySelectorAll('.skeleton__line')).toHaveLength(6);
  });

  it('shows items with a badge or a chevron', async () => {
    const badges = await shown({ kind: 'rows', count: 2, shape: 'item', trail: 'badge' });
    expect(badges.querySelectorAll('.skeleton__row--item')).toHaveLength(2);
    expect(badges.querySelectorAll('.skeleton__badge')).toHaveLength(2);

    TestBed.resetTestingModule();
    const chevrons = await shown({ kind: 'rows', count: 2, lead: 'circle', trail: 'chevron', lines: 3 });
    expect(chevrons.querySelectorAll('.skeleton__chevron')).toHaveLength(2);
    expect(chevrons.querySelectorAll('.skeleton__lead--circle')).toHaveLength(2);
    expect(chevrons.querySelectorAll('.skeleton__line')).toHaveLength(6);
  });

  it('stays hidden from assistive technology', async () => {
    const { container, fixture } = await render(SkeletonComponent, { inputs: { kind: 'rows' } });

    await vi.advanceTimersByTimeAsync(300);
    fixture.detectChanges();

    expect(fixture.nativeElement as HTMLElement).toHaveAttribute('aria-hidden', 'true');
    await noViolations(container);
  });
});

describe('skeletonSections', () => {
  const row = (index: number): { lines: string[] } => ({ lines: [String(index)] });

  it('makes one section without labels', () => {
    expect(skeletonSections(3, [], row)).toEqual([{ label: false, rows: [row(0), row(1), row(2)] }]);
  });

  it('starts a labelled section at each label index and ignores indexes out of range', () => {
    const sections = skeletonSections(5, [2, 0, 9], row);

    expect(sections.map((section) => [section.label, section.rows.length])).toEqual([
      [true, 2],
      [true, 3],
    ]);
  });

  it('keeps the rows before the first label in an unlabelled section', () => {
    const sections = skeletonSections(4, [2], row);

    expect(sections.map((section) => [section.label, section.rows.length])).toEqual([
      [false, 2],
      [true, 2],
    ]);
  });
});
