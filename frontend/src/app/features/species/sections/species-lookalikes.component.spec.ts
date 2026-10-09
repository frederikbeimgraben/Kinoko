import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../../testing/i18n';
import { speciesEntry } from '../../../testing/species-fixture';
import type { Lookalike, SpeciesEntry } from '../../../core/api/models';
import { SpeciesStore } from '../species.store';
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

/** A catalogue with exactly one species with a lead photo. */
class CatalogueDouble {
  entryOf(slug: string): SpeciesEntry | null {
    return slug === SLUG ? WITH_PHOTO : null;
  }
}

const WITH_CATALOGUE = [{ provide: SpeciesStore, useClass: CatalogueDouble }];

describe('SpeciesLookalikesComponent', () => {
  it('zeigt Name, unterscheidenden Satz und das Titelbild am Zeilenanfang', async () => {
    const { container } = await render(SpeciesLookalikesComponent, {
      providers: WITH_CATALOGUE,
      inputs: { lookalikes: LOOKALIKES },
    });

    expect(screen.getByText('Gallenröhrling')).toBeInTheDocument();
    expect(screen.getByText('Röhren rosa, Netz grob, bitter')).toBeInTheDocument();
    expect(container.querySelector('.row__lead app-private-image')).not.toBeNull();
    expect(container.querySelector('.row__trail .lookalike__compare')).not.toBeNull();
    expect(container.querySelector('.row__chevron')).not.toBeNull();
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

  it('öffnet die Art über die ganze Zeile, per LookalikeRow.dc.html', async () => {
    const opened: string[] = [];
    const { container } = await render(SpeciesLookalikesComponent, {
      inputs: { lookalikes: LOOKALIKES },
      on: { opened: (slug: string) => opened.push(slug) },
    });
    const open = container.querySelector('.lookalike__open');
    if (open === null) throw new Error('Die Zeile hat keine Fläche zum Öffnen.');

    expect(open.closest('.row__lead')).not.toBeNull();
    await userEvent.click(open);

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
