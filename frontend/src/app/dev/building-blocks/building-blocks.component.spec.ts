import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { BuildingBlocksComponent } from './building-blocks.component';

/** jsdom kennt keinen IntersectionObserver. `app-infinite-list` braucht ihn. */
class ObserverStub {
  observe(): void {
    // Der Fühler bleibt in diesem Test ungenutzt.
  }

  unobserve(): void {
    // Der Stummel braucht keine Buchführung über das Ziel.
  }

  disconnect(): void {
    // Der Stummel räumt nichts auf.
  }
}

describe('BuildingBlocksComponent', () => {
  const providers = [provideRouter([]), provideHttpClient(), provideHttpClientTesting()];

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', ObserverStub);
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:eins', revokeObjectURL: () => undefined });
  });

  it('zeigt jeden Baustein zweimal, hell und dunkel', async () => {
    const { container } = await render(BuildingBlocksComponent, { providers });

    expect(screen.getByRole('heading', { level: 1, name: 'Bausteine' })).toBeInTheDocument();
    const cards = container.querySelectorAll('app-card');
    // Die Vorlage trägt 58 Bausteinkarten je Feld, macht 116 insgesamt.
    expect(cards.length).toBe(116);
    for (const selector of ['app-nav', 'app-sheet', 'app-list-row', 'app-svg-icon']) {
      expect(container.querySelectorAll(selector).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('legt die Theme-Werte des Kits auf die beiden Felder', async () => {
    const style = document.createElement('style');
    style.textContent = ":root[data-theme='light']{--color-bg:#fff}:root[data-theme='dark']{--color-bg:#000}";
    document.head.append(style);

    const { container } = await render(BuildingBlocksComponent, { providers });
    const fields = container.querySelectorAll<HTMLElement>('.workshop__field');

    expect(fields[0].style.getPropertyValue('--color-bg')).toBe('#fff');
    expect(fields[1].style.getPropertyValue('--color-bg')).toBe('#000');
    style.remove();
  });

  it('bleibt frei von Verstößen gegen die Barrierefreiheit', async () => {
    const { container } = await render(BuildingBlocksComponent, { providers });

    // Die Seite zeigt jeden Baustein zweimal. Eine Landmarke steht darum
    // doppelt, was nur hier gilt und keine Seite der App betrifft.
    await noViolations(container, ['landmark-unique']);
  }, 90_000);
});
