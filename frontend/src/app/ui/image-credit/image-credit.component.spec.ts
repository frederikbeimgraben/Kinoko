import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ImageCreditComponent } from './image-credit.component';

describe('ImageCreditComponent', () => {
  it('nennt Fotograf und Lizenz in einer Zeile', async () => {
    const { container } = await render(ImageCreditComponent, {
      inputs: { photographer: 'Marie Weber', licence: 'cc_by_sa_4' },
    });

    expect(container.querySelector('.credit')?.textContent.replace(/\s+/g, ' ').trim()).toBe(
      'Foto: Marie Weber · CC BY-SA 4.0',
    );
    await noViolations(container);
  });

  it('verlinkt die Lizenz auf ihren Text', async () => {
    await render(ImageCreditComponent, {
      inputs: { photographer: 'Marie Weber', licence: 'cc_by_sa_3' },
    });

    const link = screen.getByRole('link', { name: 'CC BY-SA 3.0' });
    expect(link).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/3.0/');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('verlinkt den Namen auf eine Quelle mit Webadresse', async () => {
    const source = 'https://commons.wikimedia.org/wiki/File:Boletus_edulis.jpg';
    const { container } = await render(ImageCreditComponent, {
      inputs: { photographer: 'Holger Krisp', licence: 'cc_by_3', source },
    });

    expect(screen.getByRole('link', { name: 'Holger Krisp' })).toHaveAttribute('href', source);
    await noViolations(container);
  });

  it('zeigt eine Quelle ohne Webadresse nicht als Link', async () => {
    await render(ImageCreditComponent, {
      inputs: { photographer: 'Marie Weber', licence: 'public_domain', source: 'Pilzbuch, S. 12' },
    });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText(/Public Domain/)).toBeInTheDocument();
  });

  it('schreibt ein eigenes Foto als solches aus', async () => {
    await render(ImageCreditComponent, {
      inputs: { photographer: 'Frederik Beimgraben', licence: 'own' },
    });

    expect(screen.getByText('Foto: Frederik Beimgraben · Eigenes Foto')).toBeInTheDocument();
  });

  it('kennt jede Lizenz aus der Tabelle', async () => {
    const licences = [
      'cc0',
      'cc_by_4',
      'cc_by_sa_4',
      'cc_by_3',
      'cc_by_sa_3',
      'cc_by_2_5',
      'cc_by_sa_2_5',
      'cc_by_2',
      'cc_by_sa_2',
      'public_domain',
    ] as const;
    for (const licence of licences) {
      TestBed.resetTestingModule();
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
