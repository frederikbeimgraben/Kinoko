import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { IntersectionObserverStub, stubIntersectionObserver } from '../../testing/observer-stub';
import { BAY_BOLETE, HEDGEHOG, PENNY_BUN } from '../../testing/species-fixture';
import { factsOf } from './facets';
import { SpeciesResultsComponent } from './species-results.component';
import type { CatalogueEntry } from './species.state';

const KINDS = new Map<string, string>();

function entry(species: typeof PENNY_BUN): CatalogueEntry {
  return { species, facts: factsOf(species, KINDS) };
}

const HITS = [entry(PENNY_BUN), entry(BAY_BOLETE)];

describe('SpeciesResultsComponent', () => {
  beforeEach(() => {
    stubIntersectionObserver();
  });

  it('stellt je Treffer eine Zeile mit Namen und Speisewert', async () => {
    const { container } = await render(SpeciesResultsComponent, { inputs: { hits: HITS } });

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Imleria badia')).toBeInTheDocument();
    expect(screen.getAllByText('essbar')).toHaveLength(2);
    await noViolations(container);
  });

  it('meldet die gewählte Art nach draußen', async () => {
    const { fixture } = await render(SpeciesResultsComponent, { inputs: { hits: HITS } });
    const chosen: string[] = [];
    fixture.componentInstance.chosen.subscribe((slug) => chosen.push(slug));

    await userEvent.click(screen.getByText('Steinpilz'));

    expect(chosen).toEqual(['steinpilz']);
  });

  it('hebt die aktive Art hervor', async () => {
    const { container } = await render(SpeciesResultsComponent, {
      inputs: { hits: HITS, active: 'maronenroehrling' },
    });

    expect(container.querySelectorAll('.row--active')).toHaveLength(1);
  });

  it('zeigt beim Laden Platzhalter statt Zeilen', async () => {
    const { container } = await render(SpeciesResultsComponent, {
      inputs: { hits: [], loading: true },
    });

    expect(container.querySelectorAll('.results__skeleton')).toHaveLength(5);
    expect(screen.queryByText('Steinpilz')).not.toBeInTheDocument();
  });

  it('zeigt den Fehlerzustand mit dem erneuten Versuch', async () => {
    const { fixture } = await render(SpeciesResultsComponent, {
      inputs: { hits: [], failed: true },
    });
    let calls = 0;
    fixture.componentInstance.retry.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(calls).toBe(1);
  });

  it('zeigt ohne Treffer den Leerzustand mit Zurücksetzen', async () => {
    const { fixture } = await render(SpeciesResultsComponent, { inputs: { hits: [] } });
    let calls = 0;
    fixture.componentInstance.resetFilter.subscribe(() => (calls += 1));

    expect(screen.getByText('Keine Art passt zu dieser Auswahl')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));

    expect(calls).toBe(1);
  });

  it('stellt die Arten ohne Angabe blass unter die Treffer', async () => {
    const { container } = await render(SpeciesResultsComponent, {
      inputs: { hits: HITS, unassessable: [entry(HEDGEHOG)] },
    });

    expect(screen.getByText('Nicht beurteilbar · 1')).toBeInTheDocument();
    expect(container.querySelector('.results__card--muted')).not.toBeNull();
    expect(screen.getAllByText('essbar')).toHaveLength(2);
  });

  it('fordert die nächste Seite an, sobald der Fühler sichtbar wird', async () => {
    const { fixture } = await render(SpeciesResultsComponent, {
      inputs: { hits: HITS, hasMore: true },
    });
    let calls = 0;
    fixture.componentInstance.more.subscribe(() => (calls += 1));
    await fixture.whenStable();

    IntersectionObserverStub.instances[0].trigger(true);

    expect(calls).toBe(1);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SpeciesResultsComponent, {
      inputs: { hits: [] },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
