import { TestBed } from '@angular/core/testing';
import { fireEvent, render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { speciesEntry, speciesBundle } from '../../testing/species-fixture';
import { SpeciesSizeComponent } from './filter-size.component';
import { SpeciesFilterState } from './filter.state';

const STEINPILZ = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  measurements: [{ part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 8, high: 20 }] }],
});

const BUNDLE = speciesBundle([STEINPILZ]);

interface Setup {
  container: Element;
  filter: SpeciesFilterState;
}

/** Die vier Griffe: erst die Spanne der Hutbreite, dann das Jahresband. */
function handles(): HTMLElement[] {
  return screen.getAllByRole('slider');
}

function drag(handle: HTMLElement, value: number): void {
  fireEvent.input(handle, { target: { value: String(value) } });
}

async function build(): Promise<Setup> {
  const { container } = await render(SpeciesSizeComponent, { providers: catalogueProviders(BUNDLE) });
  await catalogueReady();
  await vi.waitFor(() => {
    expect(handles()).toHaveLength(4);
  });
  return { container, filter: TestBed.inject(SpeciesFilterState) };
}

describe('SpeciesSizeComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.speciesfilter');
  });

  it('spannt die Skala bis zur breitesten Kappe, auf Schritte gerundet', async () => {
    const { container } = await build();

    expect(screen.getByText('Hutbreite')).toBeInTheDocument();
    expect(container.querySelector('.size__value')?.textContent).toContain('0 – 30');
    expect(container.querySelector('.size__scale')?.textContent).toContain('15');
    await noViolations(container);
  });

  it('schreibt die gezogene Spanne in den Filter', async () => {
    const { filter } = await build();

    drag(handles()[0], 6);
    drag(handles()[1], 18);

    expect(filter.sizeOf('cap.width')).toEqual([6, 18]);
  });

  it('beginnt das Jahresband beim ganzen Jahr', async () => {
    const { container } = await build();

    expect(container.querySelector('.size__period')?.textContent).toContain('Januar bis Dezember');
  });

  it('macht aus dem Jahresband die Monate des Filters', async () => {
    const { filter } = await build();

    drag(handles()[3], 9);
    drag(handles()[2], 7);

    expect([...filter.chosenIn('period')].sort()).toEqual(['7', '8', '9']);
  });

  it('nimmt die Monate wieder weg, sobald das ganze Jahr dasteht', async () => {
    const { filter } = await build();
    drag(handles()[2], 7);

    drag(handles()[2], 1);

    expect(filter.chosenIn('period').size).toBe(0);
  });

  it('nennt die gewählte Spanne im Jahr', async () => {
    const { container, filter } = await build();

    filter.toggle('period', '7');
    filter.toggle('period', '8');

    await vi.waitFor(() => {
      expect(container.querySelector('.size__period')?.textContent).toContain('Juli bis August');
    });
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SpeciesSizeComponent, {
      providers: [...catalogueProviders(BUNDLE), EMPTY_CATALOG],
    });
    await catalogueReady();

    noGermanText(container);
  });
});
