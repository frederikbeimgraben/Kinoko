import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../../testing/i18n';
import { speciesEntry } from '../../../testing/species-fixture';
import type { Lookalike, SpeciesEntry } from '../../../core/api/models';
import { SpeciesState } from '../species.state';
import { SpeciesLookalikesComponent } from './species-lookalikes.component';

const SLUG = 'tylopilus-felleus';

const LOOKALIKES: readonly Lookalike[] = [
  {
    slug: SLUG,
    name: 'Gallenröhrling',
    scientificName: 'Tylopilus felleus',
    edibility: 'inedible',
    capColours: [{ name: 'hellbraun', hex: '#d8b98a' }],
    difference: 'Röhren rosa, Netz grob, bitter',
  },
];

const WITH_PHOTO = speciesEntry({
  slug: SLUG,
  name: 'Gallenröhrling',
  scientificName: 'Tylopilus felleus',
  leadPhotoId: 'bild-eins',
});

/** Ein Katalog, der genau eine Art mit Titelbild kennt. */
class CatalogueDouble {
  entryOf(slug: string): SpeciesEntry | null {
    return slug === SLUG ? WITH_PHOTO : null;
  }
}

const WITH_CATALOGUE = [{ provide: SpeciesState, useClass: CatalogueDouble }];

/** Die Marken der Elemente am Zeilenende, in ihrer Reihenfolge. */
function wayTags(container: Element): string[] {
  const ways = container.querySelector('.lookalike__ways');
  if (ways === null) throw new Error('Die Zeile trägt kein Ende.');
  return Array.from(ways.children).map((child) => child.tagName.toLowerCase());
}

describe('SpeciesLookalikesComponent', () => {
  it('zeigt Name, unterscheidenden Satz und das Titelbild am Zeilenanfang', async () => {
    const { container } = await render(SpeciesLookalikesComponent, {
      providers: WITH_CATALOGUE,
      inputs: { lookalikes: LOOKALIKES },
    });

    expect(screen.getByText('Gallenröhrling')).toBeInTheDocument();
    expect(screen.getByText('Röhren rosa, Netz grob, bitter')).toBeInTheDocument();
    expect(container.querySelector('.row__lead app-private-image')).not.toBeNull();
    expect(wayTags(container)).toEqual(['button', 'button']);
    await noViolations(container);
  });

  it('zeigt ohne Titelbild die Hutfarbe als Ersatz', async () => {
    const { container } = await render(SpeciesLookalikesComponent, {
      inputs: { lookalikes: LOOKALIKES },
    });

    expect(container.querySelector('.lookalike__photo')).not.toBeNull();
    expect(container.querySelector('.private__image')).toBeNull();
    await noViolations(container);
  });

  it('meldet den Vergleich und die Artseite getrennt', async () => {
    const compared: string[] = [];
    const opened: string[] = [];
    await render(SpeciesLookalikesComponent, {
      inputs: { lookalikes: LOOKALIKES },
      on: {
        compared: (slug: string) => compared.push(slug),
        opened: (slug: string) => opened.push(slug),
      },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Vergleichen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Gallenröhrling' }));

    expect(compared).toEqual([SLUG]);
    expect(opened).toEqual([SLUG]);
  });

  it('bleibt ohne Verwechslung leer', async () => {
    const { container } = await render(SpeciesLookalikesComponent, { inputs: { lookalikes: [] } });

    expect(container.querySelectorAll('app-list-row')).toHaveLength(0);
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const english: readonly Lookalike[] = [
      {
        slug: SLUG,
        name: 'Bitter bolete',
        scientificName: 'Tylopilus felleus',
        edibility: 'inedible',
        capColours: [{ name: 'light brown', hex: '#d8b98a' }],
        difference: 'Pink pores, coarse net, bitter taste',
      },
    ];
    const { container } = await render(SpeciesLookalikesComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { lookalikes: english },
    });

    noGermanText(container);
  });
});
