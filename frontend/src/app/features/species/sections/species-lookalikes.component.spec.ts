import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../../testing/axe';
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
    difference: null,
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

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null | undefined): CSSStyleDeclaration {
  if (element === null || element === undefined) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

/** Die Marken der Elemente am Zeilenende, in ihrer Reihenfolge. */
function actionTags(container: Element): string[] {
  const action = container.querySelector('.lookalike__ways');
  if (action === null) throw new Error('Die Zeile trägt kein Ende.');
  return Array.from(action.children).map((child) => child.tagName.toLowerCase());
}

describe('SpeciesLookalikesComponent', () => {
  it('setzt den Namen an den Zeilenanfang und das Foto ans Zeilenende', async () => {
    const { container } = await render(SpeciesLookalikesComponent, {
      providers: WITH_CATALOGUE,
      inputs: { lookalikes: LOOKALIKES },
    });

    expect(screen.getByText('Gallenröhrling')).toBeInTheDocument();
    expect(container.querySelector('.row__lead')?.childElementCount).toBe(0);
    expect(actionTags(container)).toEqual(['button', 'button', 'app-private-image']);
    const photo = styleOf(container.querySelector('.lookalike__photo'));
    expect(photo.getPropertyValue('inline-size')).toBe('var(--size-thumb)');
    expect(photo.getPropertyValue('block-size')).toBe('var(--size-thumb)');
    await noViolations(container);
  });

  it('hält ohne Foto keinen Platz frei', async () => {
    const { container } = await render(SpeciesLookalikesComponent, {
      inputs: { lookalikes: LOOKALIKES },
    });

    expect(screen.getByText('Gallenröhrling')).toBeInTheDocument();
    expect(container.querySelector('app-private-image')).toBeNull();
    expect(container.querySelector('.lookalike__photo')).toBeNull();
    expect(container.querySelector('.lookalike__image')).toBeNull();
    expect(container.querySelector('.row__lead')?.childElementCount).toBe(0);
    expect(actionTags(container)).toEqual(['button', 'button']);
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
});
