import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { MonoComponent } from './mono.component';

describe('MonoComponent', () => {
  it('zeigt den Text in fester Breite Schrift', async () => {
    const { container } = await render(MonoComponent, {
      inputs: { text: '[12:04] Lauf gestartet\n[12:19] fertig' },
    });

    expect(screen.getByText(/Lauf gestartet/)).toBeInTheDocument();
    expect(container.querySelector('pre.mono')).toBeInTheDocument();
    await noViolations(container);
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(MonoComponent, {
      inputs: { text: 'chosen 40 features' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
