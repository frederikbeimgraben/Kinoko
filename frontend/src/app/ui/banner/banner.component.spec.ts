import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { BannerComponent } from './banner.component';
import { ConnectionNotice } from './connection-notice';

describe('BannerComponent', () => {
  it('meldet, dass keine Verbindung steht, im Fehlerton', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'noConnection' },
    });

    const banner = screen.getByRole('button', { name: 'Keine Verbindung' });
    expect(banner).toHaveClass('banner--error');
    await noViolations(container);
  });

  it('meldet sich als sichtbare Verbindungsmeldung an und wieder ab', async () => {
    const { fixture } = await render(BannerComponent, { inputs: { kind: 'noConnection' } });
    const notice = TestBed.inject(ConnectionNotice);
    expect(notice.shown()).toBe(true);

    fixture.componentRef.setInput('kind', 'pending');
    fixture.detectChanges();
    expect(notice.shown()).toBe(false);

    fixture.componentRef.setInput('kind', 'noConnection');
    fixture.detectChanges();
    fixture.destroy();
    expect(notice.shown()).toBe(false);
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

  it('reports a new version with the check icon, in the info tone', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'update' },
    });

    const banner = screen.getByRole('button', { name: 'Neue Version bereit' });
    expect(banner).toHaveClass('banner--info');
    expect(container.querySelector('.banner__glyph')).not.toBeNull();
    await noViolations(container);
  });

  it('has an action and reports its click from the full area', async () => {
    const { container, fixture } = await render(BannerComponent, {
      inputs: { kind: 'update', actionIcon: 'refresh', actionLabel: 'app.update.reload' },
    });
    let calls = 0;
    fixture.componentInstance.actionClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Neu laden' }));

    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('shows a chevron when it has no action', async () => {
    const { container } = await render(BannerComponent, { inputs: { kind: 'pending' } });

    expect(container.querySelector('.banner__chev')).not.toBeNull();
    expect(container.querySelector('.banner__action')).toBeNull();
  });

  it('shows only the action icon when it has an action', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'update', actionIcon: 'refresh', actionLabel: 'app.update.reload' },
    });

    expect(container.querySelectorAll('.banner__action')).toHaveLength(1);
    expect(container.querySelector('.banner__chev')).toBeNull();
  });

  it('shows its own text, a count pill and no chevron on request', async () => {
    const { container } = await render(BannerComponent, {
      inputs: { kind: 'noConnection', text: 'Keine Verbindung', count: '2 ausstehend', chev: false },
    });

    expect(container.querySelector('.banner__text')).toHaveTextContent('Keine Verbindung');
    expect(container.querySelector('.banner__count')).toHaveTextContent('2 ausstehend');
    expect(container.querySelector('.banner__chev')).toBeNull();
  });

  it('floats with a shadow and without a margin', async () => {
    const { container } = await render(BannerComponent, { inputs: { kind: 'update', float: true } });

    expect(container).toHaveClass('banner-host--float');
    expect(container.querySelector('.banner')).toHaveStyle({ margin: '0px' });
  });

  it('has the kit geometry: 48 px high with a gap of 14 px', async () => {
    const { container } = await render(BannerComponent, { inputs: { kind: 'pending' } });

    const style = getComputedStyle(container.querySelector('.banner') ?? container);
    expect(style.getPropertyValue('block-size')).toBe('48px');
    expect(style.gap).toBe('14px');
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
    if (banner === null) throw new Error('The banner is not in the tree.');

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
