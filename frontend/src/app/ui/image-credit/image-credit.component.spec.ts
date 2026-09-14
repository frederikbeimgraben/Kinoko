import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ImageCreditComponent } from './image-credit.component';

describe('ImageCreditComponent', () => {
  it('nennt Fotograf und Lizenz in einer Zeile', async () => {
    const { container } = await render(ImageCreditComponent, {
      inputs: { photographer: 'Marie Weber', licence: 'cc-by-sa-4' },
    });

    expect(screen.getByText('Foto: Marie Weber · CC BY-SA 4.0')).toBeInTheDocument();
    await noViolations(container);
  });

  it('schreibt ein eigenes Foto als solches aus', async () => {
    await render(ImageCreditComponent, {
      inputs: { photographer: 'Frederik Beimgraben', licence: 'own' },
    });

    expect(screen.getByText('Foto: Frederik Beimgraben · Eigenes Foto')).toBeInTheDocument();
  });

  it('kennt jede Lizenz aus der Tabelle', async () => {
    const licences = ['cc0', 'cc-by-4', 'cc-by-sa-4', 'public-domain'] as const;
    for (const licence of licences) {
      const { container } = await render(ImageCreditComponent, {
        inputs: { photographer: 'Marie Weber', licence },
      });

      expect(container.querySelector('.credit')?.textContent).toContain('Marie Weber');
    }
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(ImageCreditComponent, {
      inputs: { photographer: 'Marie Weber', licence: 'cc0' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
