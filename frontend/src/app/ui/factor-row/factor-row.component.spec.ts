import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { FactorRowComponent } from './factor-row.component';

describe('FactorRowComponent', () => {
  it('zeigt Zeichen, Name, Bereich und Bedingung', async () => {
    const { container, fixture } = await render(FactorRowComponent, {
      inputs: {
        factor: { name: 'Niederschlag', range: 'Summe KW 37 bis 40', condition: '≥ 80 mm' },
        icon: 'cloud',
        removeLabel: 'Faktor entfernen',
      },
    });
    await fixture.whenStable();

    expect(screen.getByText('Niederschlag')).toBeInTheDocument();
    expect(screen.getByText('Summe KW 37 bis 40')).toBeInTheDocument();
    expect(container.querySelector('.factor__icon')).not.toBeNull();
    const condition = screen.getByRole('button', { name: '≥ 80 mm' });
    expect(condition).toHaveClass('tap');
    expect(condition).toHaveAttribute('data-press', 'scale');
    expect(screen.queryByRole('checkbox')).toBeNull();
    await noViolations(container);
  });

  it('lässt den Bereich weg, wo der Faktor keinen hat', async () => {
    const { fixture } = await render(FactorRowComponent, {
      inputs: { factor: { name: 'Bodenfeuchte', condition: '≥ 40 %' }, removeLabel: 'Entfernen' },
    });
    await fixture.whenStable();

    expect(screen.queryByText('Bodenfeuchte')?.nextElementSibling).toBeNull();
  });

  it('meldet das Entfernen und den Griff zur Bedingung', async () => {
    const { fixture } = await render(FactorRowComponent, {
      inputs: { factor: { name: 'Boden pH', condition: '≤ 5,5' }, removeLabel: 'Faktor entfernen' },
    });
    await fixture.whenStable();
    let removed = 0;
    let condition = 0;
    fixture.componentInstance.remove.subscribe(() => (removed += 1));
    fixture.componentInstance.conditionClick.subscribe(() => (condition += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Faktor entfernen' }));
    await userEvent.click(screen.getByRole('button', { name: '≤ 5,5' }));

    expect(removed).toBe(1);
    expect(condition).toBe(1);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container, fixture } = await render(FactorRowComponent, {
      inputs: { factor: { name: 'Factor', range: 'Range', condition: '1' }, removeLabel: 'Remove' },
      providers: [EMPTY_CATALOG],
    });
    await fixture.whenStable();

    noGermanText(container);
  });
});
