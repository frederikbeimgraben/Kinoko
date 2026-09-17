import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { ChoiceRowComponent } from './choice-row.component';

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null | undefined): CSSStyleDeclaration {
  if (element === null || element === undefined) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

describe('ChoiceRowComponent', () => {
  it('zeigt Name und Zahl und trägt den Druckzustand', async () => {
    const { container, fixture } = await render(ChoiceRowComponent, {
      inputs: { label: 'essbar', count: '77' },
    });
    await fixture.whenStable();

    expect(screen.getByText('77')).toBeInTheDocument();
    const box = screen.getByRole('checkbox', { name: /essbar/ });
    expect(box.closest('.row')).toHaveClass('tap');
    expect(box.closest('.row')).toHaveAttribute('data-press', 'tint');
    await noViolations(container);
  });

  it('setzt Name und Zahl auf die Zeilenhöhe des Boards', async () => {
    const { container } = await render(ChoiceRowComponent, { inputs: { label: 'essbar', count: '77' } });

    expect(styleOf(container.querySelector('.row__label')).lineHeight).toBe('1.2');
    expect(styleOf(container.querySelector('.row__count')).lineHeight).toBe('1.4');
  });

  it('lässt die Zahl weg, wo keine da ist', async () => {
    const { container } = await render(ChoiceRowComponent, { inputs: { label: 'essbar' } });

    expect(container.querySelector('.row__count')).toBeNull();
  });

  it('zeigt einen bereits gewählten Wert', async () => {
    const { fixture } = await render(ChoiceRowComponent, {
      inputs: { label: 'giftig', checked: true },
    });
    await fixture.whenStable();

    expect(screen.getByRole('checkbox', { name: /giftig/ })).toBeChecked();
  });

  it('meldet die Wahl beim Tippen und über die Taste', async () => {
    const { fixture } = await render(ChoiceRowComponent, { inputs: { label: 'bedingt essbar' } });
    await fixture.whenStable();
    const seen: boolean[] = [];
    fixture.componentInstance.toggled.subscribe((value) => seen.push(value));
    const box = screen.getByRole('checkbox', { name: /bedingt essbar/ });

    await userEvent.click(box);
    box.focus();
    await userEvent.keyboard(' ');

    expect(seen).toEqual([true, false]);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container, fixture } = await render(ChoiceRowComponent, {
      inputs: { label: 'Choice', count: '5' },
      providers: [EMPTY_CATALOG],
    });
    await fixture.whenStable();

    noGermanText(container);
  });
});
