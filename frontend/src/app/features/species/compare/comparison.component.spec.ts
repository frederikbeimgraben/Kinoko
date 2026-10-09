import { signal, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../../testing/catalogue-double';
import { EMPTY_CATALOG, noGermanText } from '../../../testing/i18n';
import { ViewportService } from '../../../core/layout/viewport.service';
import { ANY_ROUTE } from '../../../testing/routes';
import { speciesBundle, speciesEntry } from '../../../testing/species-fixture';
import { ComparisonComponent } from './comparison.component';
import { ComparisonStore } from './comparison.store';

const WHITE = { name: 'weiß', hex: '#f0ece0' };
const PINK = { name: 'rosa', hex: '#e8c8cf' };
const BROWN = { name: 'braun', hex: '#6b4423' };

const STONE = speciesEntry({
  slug: 'steinpilz',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  periodStartMonth: 5,
  periodEndMonth: 11,
  measurements: [{ part: 'cap', measurements: [{ dimension: 'width', unit: 'cm', low: 4, high: 20 }] }],
  colours: [
    { part: 'cap', mode: 'gradient', colours: [BROWN] },
    { part: 'tubes', mode: 'distinct', colours: [WHITE] },
  ],
  hymeniumType: 'tubes',
  partNotes: [{ part: 'stem', description: 'weiß, fein', comment: '' }],
});

const GALL = speciesEntry({
  slug: 'gallenroehrling',
  name: 'Gallenröhrling',
  scientificName: 'Tylopilus felleus',
  edibility: 'inedible',
  colours: [{ part: 'tubes', mode: 'single', colours: [PINK] }],
  hymeniumType: 'tubes',
});

const BARE = speciesEntry({ slug: 'kahlkopf', name: 'Kahlkopf', scientificName: 'Psilocybe' });
const PLAIN = speciesEntry({ slug: 'plain', name: 'Plain', scientificName: 'Plain' });

const BUNDLE = speciesBundle([STONE, GALL, BARE, PLAIN]);

/** A window with the width of the desktop. */
const WIDE: Provider = { provide: ViewportService, useValue: { wide: signal(true) } };

/** Builds the page with the choice in the query parameter `arten`, as a link gives it. */
async function build(slugs: readonly string[], extra: Provider[] = []): Promise<Element> {
  const view = await render(ComparisonComponent, {
    providers: [...catalogueProviders(BUNDLE), provideRouter(ANY_ROUTE), ...extra],
    inputs: { arten: slugs.join(',') },
  });
  await catalogueReady();
  view.fixture.detectChanges();
  return view.container;
}

describe('ComparisonComponent', () => {
  it('names the species as the heads of the columns', async () => {
    const container = await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Gallenröhrling')).toBeInTheDocument();
    await noViolations(container);
  });

  it('puts the edibility of both species side by side', async () => {
    await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getByText('essbar')).toBeInTheDocument();
    expect(screen.getByText('ungenießbar')).toBeInTheDocument();
  });

  it('shows the cap width and the note of the stem from the catalogue', async () => {
    const container = await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getByText('Breite')).toBeInTheDocument();
    expect(container.querySelector('.cmpr .v')?.textContent).toContain('20');
    expect(screen.getByText('weiß, fein')).toBeInTheDocument();
  });

  it('names the kind of hymenium', async () => {
    await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getAllByText('Röhren')).toHaveLength(2);
  });

  it('shows the time of growth as the season', async () => {
    await build(['steinpilz']);

    expect(screen.getByText('Zeit')).toBeInTheDocument();
    expect(screen.getByText('Mai – Nov.')).toBeInTheDocument();
  });

  it('leaves out a row where no species has a value', async () => {
    await build(['kahlkopf']);

    expect(screen.getByText('Kahlkopf')).toBeInTheDocument();
    expect(screen.queryByText('Breite')).not.toBeInTheDocument();
    expect(screen.queryByText('Zeit')).not.toBeInTheDocument();
  });

  it('hides an equal row with "only differences" from the menu', async () => {
    const view = await render(ComparisonComponent, {
      providers: [...catalogueProviders(BUNDLE), provideRouter(ANY_ROUTE)],
      inputs: { arten: 'steinpilz,gallenroehrling' },
    });
    await catalogueReady();
    view.fixture.detectChanges();

    expect(screen.getAllByText('Röhren')).toHaveLength(2);

    screen.getByRole('button', { name: 'Mehr' }).click();
    view.fixture.detectChanges();
    screen.getByRole('button', { name: 'Nur Unterschiede' }).click();
    view.fixture.detectChanges();

    expect(screen.queryAllByText('Röhren')).toHaveLength(0);
  });

  it('shows the list pane next to the table on the desktop', async () => {
    const container = await build(['steinpilz', 'gallenroehrling'], [WIDE]);

    expect(container.querySelector('app-species-browser')).not.toBeNull();
    expect(container.querySelector('.compare--wide')).not.toBeNull();
  });

  it('takes the species of the link into the store', async () => {
    await build(['gallenroehrling', 'steinpilz']);

    expect(TestBed.inject(ComparisonStore).slugs()).toEqual(['gallenroehrling', 'steinpilz']);
  });

  it('offers a place for the second species and puts the pick into the address', async () => {
    const container = await build(['steinpilz']);
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    await userEvent.click(screen.getByRole('button', { name: 'Art hinzufügen' }));
    expect(container.querySelector('app-compare-entry')).not.toBeNull();
    await userEvent.type(screen.getByRole('textbox', { name: 'Art suchen' }), 'galle');
    await userEvent.click(screen.getByRole('button', { name: /Gallenröhrling/ }));

    expect(navigate).toHaveBeenCalledWith([], {
      queryParams: { arten: 'steinpilz,gallenroehrling' },
      replaceUrl: true,
    });
  });

  it('shows no group without a choice', async () => {
    const container = await build([]);

    expect(container.querySelector('.cmpg')).toBeNull();
  });

  it('has no German word with an empty catalogue', async () => {
    const container = await build(['plain'], [EMPTY_CATALOG]);

    noGermanText(container);
  });
});
