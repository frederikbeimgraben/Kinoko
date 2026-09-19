import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { AboutTextComponent, type AboutSection } from './about-text.component';

const SECTIONS: readonly AboutSection[] = [
  { heading: 'account.method.whatHeading', body: 'account.method.whatBody' },
  { heading: 'account.method.modelHeading', body: 'account.method.modelBody' },
];

describe('AboutTextComponent', () => {
  it('zeigt Titel und Absätze mit Zwischenüberschrift', async () => {
    const { container } = await render(AboutTextComponent, {
      inputs: { title: 'account.method', sections: SECTIONS },
    });

    expect(screen.getByText('Methode')).toBeInTheDocument();
    expect(screen.getByText('Was die Karte zeigt')).toBeInTheDocument();
    expect(
      screen.getByText('Die Karte zeigt die Fundwahrscheinlichkeit je Begehung, wöchentlich aktualisiert.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Das Modell')).toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet einen Klick auf Zurück', async () => {
    const backClick = vi.fn();
    await render(AboutTextComponent, {
      inputs: { title: 'account.method', sections: SECTIONS },
      on: { backClick },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(backClick).toHaveBeenCalled();
  });
});
