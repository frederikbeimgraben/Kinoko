import { fireEvent, render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { TimelineComponent, type TimelineWeek } from './timeline.component';

const WEEKS: TimelineWeek[] = [
  { year: 2025, week: 52, share: 0.4, forecast: false },
  { year: 2026, week: 1, share: 0.8, forecast: true },
];

describe('TimelineComponent', () => {
  it('zeigt jede Woche und meldet die Wahl', async () => {
    const { container, fixture } = await render(TimelineComponent, {
      inputs: { weeks: WEEKS, active: { year: 2025, week: 52 }, label: 'Wochen' },
    });
    const selected: TimelineWeek[] = [];
    fixture.componentInstance.chosen.subscribe((week) => selected.push(week));

    expect(screen.getByRole('group', { name: 'Wochen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'KW 52 · 2025' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(screen.getByRole('button', { name: 'KW 1 · 2026 · Prognose' }));

    expect(selected[0].week).toBe(1);
    await noViolations(container);
  });

  it('setzt die Jahresmarke auf die erste Woche eines neuen Jahres', async () => {
    const { container } = await render(TimelineComponent, {
      inputs: { weeks: WEEKS, label: 'Wochen' },
    });

    const badges = container.querySelectorAll('.week__year');
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('2026');
  });

  it('läuft mit den Pfeiltasten durch die Wochen und hält an den Enden', async () => {
    const { fixture } = await render(TimelineComponent, {
      inputs: { weeks: WEEKS, active: { year: 2025, week: 52 }, label: 'Wochen' },
    });
    const selected: TimelineWeek[] = [];
    fixture.componentInstance.chosen.subscribe((week) => selected.push(week));
    screen.getByRole('button', { name: 'KW 52 · 2025' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{End}');
    await userEvent.keyboard('{Home}');
    await userEvent.keyboard('{ArrowUp}');

    expect(selected.map((week) => week.week)).toEqual([1, 52, 1, 52]);
  });

  it('hält nur die aktive Woche im Tabulator-Weg', async () => {
    await render(TimelineComponent, {
      inputs: { weeks: WEEKS, active: { year: 2026, week: 1 }, label: 'Wochen' },
    });

    expect(screen.getByRole('button', { name: /KW 1 · 2026/ })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('button', { name: 'KW 52 · 2025' })).toHaveAttribute('tabindex', '-1');
  });

  it('bleibt ohne Wochen still', async () => {
    const { container } = await render(TimelineComponent, {
      inputs: { weeks: [], label: 'Wochen' },
    });

    await userEvent.type(screen.getByRole('group', { name: 'Wochen' }), '{ArrowRight}');

    expect(container.querySelectorAll('.week')).toHaveLength(0);
  });

  it('nimmt in gedämpfter Ebene keine Pfeiltaste an', async () => {
    const { fixture } = await render(TimelineComponent, {
      inputs: { weeks: WEEKS, active: { year: 2025, week: 52 }, label: 'Wochen', dimmed: true },
    });
    const selected: TimelineWeek[] = [];
    fixture.componentInstance.chosen.subscribe((week) => selected.push(week));

    expect(screen.getByRole('group', { name: 'Wochen' })).toHaveClass('weeks--dimmed');
    await userEvent.type(screen.getByRole('group', { name: 'Wochen' }), '{ArrowRight}');

    expect(selected).toHaveLength(0);
  });

  it('schiebt die aktive Woche in die Mitte der Leiste', async () => {
    const { container } = await render(TimelineComponent, {
      inputs: { weeks: WEEKS, active: { year: 2026, week: 1 }, label: 'Wochen' },
    });
    const bar = container.querySelector<HTMLElement>('.weeks');
    if (bar === null) throw new Error('keine Leiste');
    const scrollTo = vi.fn();
    Object.defineProperty(bar, 'scrollTo', { value: scrollTo, configurable: true });
    Object.defineProperty(bar, 'clientWidth', { value: 200, configurable: true });
    const second = container.querySelectorAll<HTMLElement>('.week')[1];
    Object.defineProperty(second, 'offsetLeft', { value: 120, configurable: true });
    Object.defineProperty(second, 'offsetWidth', { value: 48, configurable: true });

    screen.getByRole('button', { name: 'KW 52 · 2025' }).focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(scrollTo).toHaveBeenCalledWith({ left: 120 - (200 - 48) / 2, behavior: 'smooth' });
  });

  it('sperrt beide Pfeile ohne verdeckte Wochen', async () => {
    await render(TimelineComponent, {
      inputs: { weeks: WEEKS, active: { year: 2025, week: 52 }, label: 'Wochen' },
    });

    expect(screen.getByRole('button', { name: 'Frühere Wochen zeigen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Spätere Wochen zeigen' })).toBeDisabled();
  });

  it('gibt die Pfeile nach verdeckten Wochen frei und schiebt beim Klick', async () => {
    vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockReturnValue(40);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(200);
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(48);
    const { container, fixture } = await render(TimelineComponent, {
      inputs: { weeks: WEEKS, active: { year: 2025, week: 52 }, label: 'Wochen' },
    });
    const bar = container.querySelector<HTMLElement>('.weeks');
    if (bar === null) throw new Error('keine Leiste');
    const scrollBy = vi.fn();
    Object.defineProperty(bar, 'scrollBy', { value: scrollBy, configurable: true });
    bar.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    const back = screen.getByRole('button', { name: 'Frühere Wochen zeigen' });
    const forward = screen.getByRole('button', { name: 'Spätere Wochen zeigen' });
    expect(back).not.toBeDisabled();
    expect(forward).not.toBeDisabled();

    fireEvent.click(back);
    expect(scrollBy).toHaveBeenCalledWith({ left: -152, behavior: 'smooth' });

    fireEvent.click(forward);
    expect(scrollBy).toHaveBeenCalledWith({ left: 152, behavior: 'smooth' });
  });

  it('schiebt ohne Bewegung, wenn der Rechner weniger Bewegung wünscht', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query.includes('reduce'),
          media: query,
          onchange: null,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          addListener: () => undefined,
          removeListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );
    vi.spyOn(Element.prototype, 'scrollLeft', 'get').mockReturnValue(40);
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(200);
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(48);
    const { container, fixture } = await render(TimelineComponent, {
      inputs: { weeks: WEEKS, active: { year: 2025, week: 52 }, label: 'Wochen' },
    });
    const bar = container.querySelector<HTMLElement>('.weeks');
    if (bar === null) throw new Error('keine Leiste');
    const scrollBy = vi.fn();
    Object.defineProperty(bar, 'scrollBy', { value: scrollBy, configurable: true });
    bar.dispatchEvent(new Event('scroll'));
    fixture.detectChanges();

    const forward = screen.getByRole('button', { name: 'Spätere Wochen zeigen' });
    fireEvent.click(forward);

    expect(scrollBy).toHaveBeenCalledWith({ left: 152, behavior: 'auto' });
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(TimelineComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { weeks: WEEKS, label: 'Weeks' },
    });

    noGermanText(container);
  });
});
