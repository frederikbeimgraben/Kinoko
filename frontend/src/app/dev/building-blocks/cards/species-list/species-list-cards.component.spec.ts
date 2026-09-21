import { render } from '@testing-library/angular';
import { catalogueProviders, catalogueReady } from '../../../../testing/catalogue-double';
import { SpeciesListCardsComponent } from './species-list-cards.component';

describe('SpeciesListCardsComponent', () => {
  it('zeigt die Karten in der Reihenfolge von blocks-cards.json', async () => {
    const { container } = await render(SpeciesListCardsComponent, {
      providers: catalogueProviders(),
    });
    await catalogueReady();

    const blocks = [...container.querySelectorAll('[data-block]')].map((el) => el.getAttribute('data-block'));
    expect(blocks).toEqual([
      'SpeciesRow',
      'SpeciesList',
      'ColourFilter',
      'FilterColumn',
      'FilterSheet',
      'FactorRow',
      'WeekStrip',
    ]);
  });

  it('trägt die Größe jeder Karte aus dem Verzeichnis', async () => {
    const { container } = await render(SpeciesListCardsComponent, {
      providers: catalogueProviders(),
    });
    await catalogueReady();

    const sizes: Record<string, { width: string; height: string }> = {
      SpeciesRow: { width: '374px', height: '72px' },
      SpeciesList: { width: '390px', height: '640px' },
      ColourFilter: { width: '358px', height: '330px' },
      FilterColumn: { width: '272px', height: '820px' },
      FilterSheet: { width: '390px', height: '640px' },
      FactorRow: { width: '358px', height: '64px' },
      WeekStrip: { width: '358px', height: '64px' },
    };
    for (const [name, size] of Object.entries(sizes)) {
      const card = container.querySelector<HTMLElement>(`[data-block="${name}"]`);
      expect(card).toHaveStyle(size);
    }
  });
});
