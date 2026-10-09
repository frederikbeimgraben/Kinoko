import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { AboutTextComponent, type AboutSection } from './about-text.component';

const SECTIONS: readonly AboutSection[] = [
  { heading: 'account.method.visits', body: 'account.method.visitsSub' },
  { heading: 'account.method.model', body: 'account.method.modelSub' },
];

describe('AboutTextComponent', () => {
  it('shows the title and a row for each part', async () => {
    const { container } = await render(AboutTextComponent, {
      inputs: { title: 'account.method', sections: SECTIONS },
    });

    expect(screen.getByText('Methode')).toBeInTheDocument();
    expect(screen.getByText('Begehungen')).toBeInTheDocument();
    expect(screen.getByText('GBIF, iNaturalist, eigene Funde')).toBeInTheDocument();
    expect(screen.getByText('Modell')).toBeInTheDocument();
    await noViolations(container);
  });

  it('reports a tap on back', async () => {
    const backClick = vi.fn();
    await render(AboutTextComponent, {
      inputs: { title: 'account.method', sections: SECTIONS },
      on: { backClick },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(backClick).toHaveBeenCalled();
  });
});
