import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { BannerComponent } from './banner.component';

describe('BannerComponent', () => {
  it('meldet, dass keine Verbindung steht, im Fehlerton', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'noConnection' },
    });

    const banner = screen.getByRole('button', { name: 'Keine Verbindung' });
    expect(banner).toHaveClass('banner--error');
    await noViolations(container);
  });

  it('meldet, dass etwas auf die Übertragung wartet, im Warnton', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'pending' },
    });

    const banner = screen.getByRole('button', { name: 'Offline' });
    expect(banner).not.toHaveClass('banner--error');
    expect(banner).not.toHaveClass('banner--info');
    await noViolations(container);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'noConnection' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });

  it('meldet eine bereitstehende Fassung ohne Piktogramm, im Hinweiston', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'update' },
    });

    const banner = screen.getByRole('button', { name: 'Neue Version' });
    expect(banner).toHaveClass('banner--info');
    expect(container.querySelector('.banner__glyph')).toBeNull();
    await noViolations(container);
  });

  it('trägt eine Aktion und meldet ihren Klick von der ganzen Fläche', async () => {
    const { container, fixture } = await render(BannerComponent, {
      inputs: { kind: 'update', actionIcon: 'refresh', actionLabel: 'app.update.reload' },
    });
    let calls = 0;
    fixture.componentInstance.actionClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Neu laden' }));

    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('trägt ohne eigene Aktion einen Pfeil als Vorgabe', async () => {
    const { container } = await render(BannerComponent, { inputs: { kind: 'pending' } });

    expect(container.querySelector('.banner__action')).not.toBeNull();
  });

  it('trägt mit einer Aktion nur deren Symbol, nicht auch den Pfeil', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'update', actionIcon: 'refresh', actionLabel: 'app.update.reload' },
    });

    expect(container.querySelectorAll('.banner__action')).toHaveLength(1);
  });

  it('ist auch ohne eigene Aktion drückbar', async () => {
    const { fixture } = await render(BannerComponent, { inputs: { kind: 'noConnection' } });
    let calls = 0;
    fixture.componentInstance.actionClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Keine Verbindung' }));

    expect(calls).toBe(1);
  });

  it('setzt einen Kreis am Berührungspunkt', async () => {
    const { container } = await render(BannerComponent, { inputs: { kind: 'noConnection' } });

    const banner = container.querySelector<HTMLElement>('.banner');
    if (banner === null) throw new Error('kein Banner');

    vi.spyOn(banner, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 390,
      height: 38,
      right: 390,
      bottom: 38,
      toJSON: () => undefined,
    });
    banner.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 20 }));

    expect(banner.querySelector('.ripple')).not.toBeNull();
  });
});
