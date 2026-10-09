import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { IntersectionObserverStub, stubIntersectionObserver } from '../../testing/observer-stub';
import { BAY_BOLETE, HEDGEHOG, PALETTE, PENNY_BUN } from '../../testing/species-fixture';
import { factsOf } from './facets';
import { SpeciesResultsComponent } from './species-results.component';
import type { CatalogueEntry } from './species.store';

function entry(species: typeof PENNY_BUN): CatalogueEntry {
  return { species, facts: factsOf(species, PALETTE) };
}

const HITS = [entry(PENNY_BUN), entry(BAY_BOLETE)];

describe('SpeciesResultsComponent', () => {
  beforeEach(() => {
    stubIntersectionObserver();
  });

  it('shows one row with name and edibility for each hit', async () => {
    const { container } = await render(SpeciesResultsComponent, { inputs: { hits: HITS } });

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Imleria badia')).toBeInTheDocument();
    expect(screen.getAllByText('essbar')).toHaveLength(2);
    await noViolations(container);
  });

  it('puts a head before each new first letter', async () => {
    const { container } = await render(SpeciesResultsComponent, { inputs: { hits: HITS } });

    const heads = [...container.querySelectorAll('.lbl')].map((el) => el.textContent);
    expect(heads).toEqual(['S', 'M']);
  });

  it('reports the chosen species', async () => {
    const { fixture } = await render(SpeciesResultsComponent, { inputs: { hits: HITS } });
    const chosen: string[] = [];
    fixture.componentInstance.chosen.subscribe((slug) => chosen.push(slug));

    await userEvent.click(screen.getByText('Steinpilz'));

    expect(chosen).toEqual(['steinpilz']);
  });

  it('marks the active species', async () => {
    const { container } = await render(SpeciesResultsComponent, {
      inputs: { hits: HITS, active: 'maronenroehrling' },
    });

    expect(container.querySelectorAll('.row--active')).toHaveLength(1);
  });

  it('gives the species that the person opened last the soft ground', async () => {
    const { container } = await render(SpeciesResultsComponent, {
      inputs: { hits: HITS, soft: 'steinpilz' },
    });

    expect(container.querySelectorAll('.row--soft')).toHaveLength(1);
  });

  it('puts the edibility as the head when the list sorts by edibility', async () => {
    const { container } = await render(SpeciesResultsComponent, {
      inputs: { hits: HITS, sort: 'edibility' },
    });

    const heads = [...container.querySelectorAll('.lbl')].map((el) => el.textContent);
    expect(heads).toEqual(['essbar']);
  });

  it('shows seven skeleton rows while the catalogue loads', async () => {
    const { container } = await render(SpeciesResultsComponent, {
      inputs: { hits: [], loading: true },
    });

    await vi.waitFor(() => {
      expect(container.querySelectorAll('.results__skeleton .skeleton__row')).toHaveLength(7);
    });
    expect(screen.queryByText('Steinpilz')).not.toBeInTheDocument();
  });

  it('shows the error state with a new try', async () => {
    const { fixture } = await render(SpeciesResultsComponent, {
      inputs: { hits: [], failed: true },
    });
    let calls = 0;
    fixture.componentInstance.retry.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));

    expect(calls).toBe(1);
  });

  it('says "Keine Treffer" without a reset when no filter is set', async () => {
    await render(SpeciesResultsComponent, { inputs: { hits: [] } });

    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Filter zurücksetzen' })).not.toBeInTheDocument();
  });

  it('shows the empty state with a reset when a filter is set', async () => {
    const { fixture } = await render(SpeciesResultsComponent, { inputs: { hits: [], filtered: true } });
    let calls = 0;
    fixture.componentInstance.resetFilter.subscribe(() => (calls += 1));

    expect(screen.getByText('Keine Treffer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));

    expect(calls).toBe(1);
  });

  it('puts the species without data pale below the hits', async () => {
    const { container } = await render(SpeciesResultsComponent, {
      inputs: { hits: HITS, unassessable: [entry(HEDGEHOG)] },
    });

    expect(screen.getByText('Nicht beurteilbar · 1')).toBeInTheDocument();
    expect(container.querySelector('.results__muted')).not.toBeNull();
    expect(screen.getAllByText('essbar')).toHaveLength(2);
  });

  it('asks for the next page when the sentinel becomes visible', async () => {
    const { fixture } = await render(SpeciesResultsComponent, {
      inputs: { hits: HITS, hasMore: true },
    });
    let calls = 0;
    fixture.componentInstance.more.subscribe(() => (calls += 1));
    await fixture.whenStable();

    IntersectionObserverStub.instances[0].trigger(true);

    expect(calls).toBe(1);
  });

  it('has no German word with an empty catalogue', async () => {
    const { container } = await render(SpeciesResultsComponent, {
      inputs: { hits: [] },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
