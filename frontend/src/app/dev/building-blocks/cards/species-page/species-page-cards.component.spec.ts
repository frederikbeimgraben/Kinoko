import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { ANY_ROUTE } from '../../../../testing/routes';
import { SpeciesPageCardsComponent } from './species-page-cards.component';

async function build(): Promise<Element> {
  const { container } = await render(SpeciesPageCardsComponent, {
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(ANY_ROUTE)],
  });
  return container;
}

describe('SpeciesPageCardsComponent', () => {
  it('zeigt die Karten in der Reihenfolge von blocks-cards.json', async () => {
    const container = await build();

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual([
      'Hero',
      'RatingSection',
      'TaxonRow',
      'SizeSection',
      'ColourSection',
      'LookalikeRow',
      'LookalikeSection',
      'PhotoStrip',
    ]);
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const container = await build();

    const sizes: Record<string, { width: string; height: string }> = {
      Hero: { width: '358px', height: '300px' },
      RatingSection: { width: '358px', height: '210px' },
      TaxonRow: { width: '358px', height: '60px' },
      SizeSection: { width: '358px', height: '340px' },
      ColourSection: { width: '358px', height: '270px' },
      LookalikeRow: { width: '358px', height: '60px' },
      LookalikeSection: { width: '358px', height: '230px' },
      PhotoStrip: { width: '358px', height: '96px' },
    };
    for (const [name, size] of Object.entries(sizes)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
