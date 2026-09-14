import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { ChoiceRowComponent } from './choice-row.component';

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
