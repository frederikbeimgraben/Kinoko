import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { BannerComponent } from './banner.component';

describe('BannerComponent', () => {
  it('meldet, dass keine Verbindung steht', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'noConnection' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Keine Verbindung');
    await noViolations(container);
  });

  it('meldet, dass etwas auf die Übertragung wartet', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'pending' },
    });

    expect(screen.getByRole('status')).toHaveTextContent('Offline');
    await noViolations(container);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'noConnection' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
