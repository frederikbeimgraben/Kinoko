import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { speciesEntry } from '../../testing/species-fixture';
import { SpeciesDetailComponent } from './species-detail.component';

const STEINPILZ = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  periodStartMonth: 6,
  periodEndMonth: 10,
  measurements: [{ part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 8, high: 20 }] }],
});

const BARE = speciesEntry({
  slug: 'kahlkopf',
  name: 'Kahlkopf',
  scientificName: 'Psilocybe semilanceata',
  protection: 'strict',
});

const BUNDLE = { items: [STEINPILZ, BARE] };

async function build(slug: string | null): Promise<{ container: Element }> {
  const { container } = await render(SpeciesDetailComponent, {
    inputs: { slug },
    providers: catalogueProviders(BUNDLE),
  });
  await catalogueReady();
  return { container };
}

describe('SpeciesDetailComponent', () => {
  it('nennt Namen, lateinischen Namen und Gruppe im Kopf', async () => {
    const { container } = await build('steinpilz');

    await vi.waitFor(() => {
      expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    });
    expect(screen.getByText('Boletus edulis · Röhrling')).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt die Einstufung mit Speisewert und Schutz', async () => {
    await build('steinpilz');

    await vi.waitFor(() => {
      expect(screen.getByText('Einstufung')).toBeInTheDocument();
    });
    expect(screen.getByText('essbar')).toBeInTheDocument();
    expect(screen.getByText('nicht geschützt')).toBeInTheDocument();
  });

  it('führt die Maße je Körperteil mit ihrer Einheit', async () => {
    const { container } = await build('steinpilz');

    await vi.waitFor(() => {
      expect(screen.getByText('Maße')).toBeInTheDocument();
    });
    expect(screen.getByText('Hut')).toBeInTheDocument();
    expect(screen.getByText('Breite')).toBeInTheDocument();
    expect(container.querySelector('.detail__measure')?.textContent).toContain('8');
    expect(container.querySelector('.detail__measure em')?.textContent).toBe('cm');
  });

  it('zeigt die Zeit als Spanne und als Band im Jahr', async () => {
    const { container } = await build('steinpilz');

    await vi.waitFor(() => {
      expect(screen.getByText('Zeit')).toBeInTheDocument();
    });
    expect(screen.getByText('Juni bis Oktober')).toBeInTheDocument();
    expect(container.querySelector('app-year-band')).not.toBeNull();
  });

  it('lässt Maße und Zeit weg, solange die Art nichts davon führt', async () => {
    await build('kahlkopf');

    await vi.waitFor(() => {
      expect(screen.getByText('Kahlkopf')).toBeInTheDocument();
    });
    expect(screen.queryByText('Maße')).not.toBeInTheDocument();
    expect(screen.queryByText('Zeit')).not.toBeInTheDocument();
  });

  it('zeigt nichts zu einer unbekannten Art', async () => {
    const { container } = await build('nichts');

    expect(container.querySelector('.detail__head')).toBeNull();
  });

  it('zeigt nichts ohne Slug', async () => {
    const { container } = await build(null);

    expect(container.querySelector('.detail__head')).toBeNull();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SpeciesDetailComponent, {
      inputs: { slug: 'steinpilz' },
      providers: [...catalogueProviders(BUNDLE), EMPTY_CATALOG],
    });
    await catalogueReady();

    noGermanText(container);
  });
});
