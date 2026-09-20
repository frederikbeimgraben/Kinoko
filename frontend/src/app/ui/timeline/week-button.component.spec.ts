import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { WeekButtonComponent } from './week-button.component';

describe('WeekButtonComponent', () => {
  it('zeichnet den Balken aus dem Anteil', async () => {
    const { container } = await render(WeekButtonComponent, {
      inputs: { year: 2026, week: 40, share: 0.5 },
    });

    expect(container.querySelector<HTMLElement>('.week__bar')?.style.inlineSize).toBe('50%');
    await noViolations(container);
  });

  it('hält den Balken zwischen null und voll', async () => {
    const { container } = await render(WeekButtonComponent, {
      inputs: { year: 2026, week: 40, share: 4 },
    });

    expect(container.querySelector<HTMLElement>('.week__bar')?.style.inlineSize).toBe('100%');
  });

  it('nennt eine Prognosewoche als solche', async () => {
    await render(WeekButtonComponent, {
      inputs: { year: 2026, week: 41, forecast: true, active: true },
    });

    expect(screen.getByRole('button', { name: 'KW 41 · 2026 · Prognose' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('meldet die Wahl beim Antippen', async () => {
    const { fixture } = await render(WeekButtonComponent, { inputs: { year: 2026, week: 40 } });
    let calls = 0;
    fixture.componentInstance.chosen.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'KW 40 · 2026' }));

    expect(calls).toBe(1);
  });

  it('setzt einen Kreis am Berührungspunkt statt der Verkleinerung', async () => {
    const { container } = await render(WeekButtonComponent, { inputs: { year: 2026, week: 40 } });

    const button = container.querySelector<HTMLElement>('.week');
    if (button === null) throw new Error('keine Taste');
    expect(button).not.toHaveAttribute('data-press');

    vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 48,
      height: 64,
      right: 48,
      bottom: 64,
      toJSON: () => undefined,
    });
    button.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 20 }));

    expect(button.querySelector('.ripple')).not.toBeNull();
  });

  it('bleibt gesperrt ohne Klick auszulösen', async () => {
    const { fixture } = await render(WeekButtonComponent, {
      inputs: { year: 2026, week: 40, locked: true },
    });
    let calls = 0;
    fixture.componentInstance.chosen.subscribe(() => (calls += 1));

    expect(screen.getByRole('button', { name: 'KW 40 · 2026' })).toBeDisabled();
    expect(calls).toBe(0);
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(WeekButtonComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { year: 2026, week: 40 },
    });

    noGermanText(container);
  });
});
