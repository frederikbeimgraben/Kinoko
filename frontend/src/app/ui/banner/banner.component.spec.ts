import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { BannerComponent } from './banner.component';

describe('BannerComponent', () => {
  it('zeigt den Offline-Zustand', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'offline' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Offline');
    await noViolations(container);
  });

  it('zeigt den Fehler-Zustand ohne Verbindung', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'error' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Keine Verbindung');
    await noViolations(container);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'offline' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
