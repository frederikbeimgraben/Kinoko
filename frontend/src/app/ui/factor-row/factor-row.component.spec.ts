import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { FactorRowComponent } from './factor-row.component';

describe('FactorRowComponent', () => {
  it('zeigt Name, Bereich und Bedingung', async () => {
    const { container, fixture } = await render(FactorRowComponent, {
      inputs: {
        factor: { name: 'Niederschlag', range: 'Summe KW 37 bis 40', condition: '≥ 80 mm' },
        active: true,
      },
    });
    // ngModel schreibt den Wert erst in einer Mikroaufgabe in das Feld.
    await fixture.whenStable();

    expect(screen.getByRole('checkbox', { name: /Niederschlag/ })).toBeChecked();
    const condition = screen.getByRole('button', { name: '≥ 80 mm' });
    expect(condition).toBeInTheDocument();
    expect(condition).toHaveClass('tap');
    expect(condition).toHaveAttribute('data-press', 'scale');
    await noViolations(container);
  });

  it('lässt den Bereich weg, wo der Faktor keinen hat', async () => {
    const { fixture } = await render(FactorRowComponent, {
      inputs: { factor: { name: 'Bodenfeuchte', condition: '≥ 40 %' } },
    });
    await fixture.whenStable();

    expect(screen.queryByText('Bodenfeuchte')?.nextElementSibling).toBeNull();
  });

  it('meldet das Abwählen und den Griff zur Bedingung', async () => {
    const { fixture } = await render(FactorRowComponent, {
      inputs: { factor: { name: 'Boden pH', condition: '≤ 5,5' }, active: true },
    });
    await fixture.whenStable();
    const toggled: boolean[] = [];
    let condition = 0;
    fixture.componentInstance.activeChange.subscribe((value) => toggled.push(value));
    fixture.componentInstance.conditionClick.subscribe(() => (condition += 1));

    await userEvent.click(screen.getByRole('checkbox', { name: /Boden pH/ }));
    await userEvent.click(screen.getByRole('button', { name: '≤ 5,5' }));

    expect(toggled).toEqual([false]);
    expect(condition).toBe(1);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container, fixture } = await render(FactorRowComponent, {
      inputs: { factor: { name: 'Factor', range: 'Range', condition: '1' } },
      providers: [EMPTY_CATALOG],
    });
    await fixture.whenStable();

    noGermanText(container);
  });
});
