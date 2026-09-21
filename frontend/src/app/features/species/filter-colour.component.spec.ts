import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { speciesEntry, speciesBundle } from '../../testing/species-fixture';
import { SpeciesColourComponent } from './filter-colour.component';
import { SpeciesFilterState } from './filter.state';

const STEINPILZ = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  colours: [
    {
      part: 'cap',
      mode: 'distinct',
      colours: [
        { name: 'hellbraun', hex: '#8a6134' },
        { name: 'braun', hex: '#6b4423' },
        { name: 'dunkelbraun', hex: '#3e2a17' },
      ],
    },
    { part: 'stem', mode: 'single', colours: [{ name: 'creme', hex: '#e8d9b5' }] },
  ],
});

const BUNDLE = speciesBundle([STEINPILZ]);

interface Setup {
  container: Element;
  filter: SpeciesFilterState;
}

/** Der Name des Körperteils, dessen Ziehharmonika-Zeile die Farbwahl zeigt. */
function openPart(container: Element): string | undefined {
  const row = container.querySelector('app-expand-row:has(app-colour-picker)');
  return row?.querySelector('.xp__head > span:first-child')?.textContent ?? undefined;
}

async function build(): Promise<Setup> {
  const { container } = await render(SpeciesColourComponent, {
    providers: catalogueProviders(BUNDLE),
  });
  await catalogueReady();
  await vi.waitFor(() => {
    expect(screen.getByText('Hut')).toBeInTheDocument();
  });
  return { container, filter: TestBed.inject(SpeciesFilterState) };
}

describe('SpeciesColourComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.speciesfilter');
  });

  it('steht im Abschnitt Farbe, per FoldSection', async () => {
    await build();

    expect(screen.getByRole('button', { name: 'Farbe' })).toBeInTheDocument();
  });

  it('führt nur die Körperteile, für die der Katalog Farben hat', async () => {
    const { container } = await build();

    expect(screen.getByText('Stiel')).toBeInTheDocument();
    expect(screen.queryByText('Lamellen')).not.toBeInTheDocument();
    expect(container.querySelectorAll('app-expand-row')).toHaveLength(2);
    await noViolations(container);
  });

  it('stellt den ersten Teil offen und die anderen zu', async () => {
    const { container } = await build();

    expect(container.querySelectorAll('app-colour-picker')).toHaveLength(1);
  });

  it('klappt einen anderen Teil auf und fällt danach auf den ersten zurück', async () => {
    const { container } = await build();

    await userEvent.click(screen.getByRole('button', { name: /Stiel/ }));
    expect(openPart(container)).toBe('Stiel');

    await userEvent.click(screen.getByRole('button', { name: /Stiel/ }));
    expect(openPart(container)).toBe('Hut');
  });

  it('wählt eine Standardfarbe für den offenen Teil', async () => {
    const { container, filter } = await build();

    await userEvent.click(screen.getByRole('radio', { name: 'Braun' }));

    expect(filter.colourOf('cap')).toBe('#6b4423');
    await vi.waitFor(() => {
      expect(container.querySelector('.xp__value')?.textContent).toBe('Braun');
    });
  });

  it('zeigt die nächsten Katalogtöne mit der Zahl der Arten', async () => {
    const { container, filter } = await build();

    filter.setColour('cap', '#6b4423');

    await vi.waitFor(() => {
      expect(screen.getByText('Nächste Töne im Katalog · 1 Arten')).toBeInTheDocument();
    });
    expect(container.querySelectorAll('.tone').length).toBeGreaterThan(0);
  });

  it('bleibt ohne Töne, solange keine Farbe gewählt ist', async () => {
    const { container } = await build();

    expect(container.querySelector('.picker__nearest')).toBeNull();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SpeciesColourComponent, {
      providers: [...catalogueProviders(BUNDLE), EMPTY_CATALOG],
    });
    await catalogueReady();

    noGermanText(container);
  });
});
