import { signal, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../../testing/axe';
import { catalogueProviders, catalogueReady } from '../../../testing/catalogue-double';
import { EMPTY_CATALOG, noGermanText } from '../../../testing/i18n';
import { ViewportService } from '../../../core/layout/viewport.service';
import { ANY_ROUTE } from '../../../testing/routes';
import { speciesBundle, speciesEntry } from '../../../testing/species-fixture';
import { ComparisonComponent } from './comparison.component';
import { ComparisonState } from './comparison.state';

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

/** Ein Fenster in Spaltenbreite. */
const WIDE: Provider = { provide: ViewportService, useValue: { wide: signal(true) } };

/** Baut die Seite und legt die Wahl in den Zustand. */
async function build(slugs: readonly string[], extra: Provider[] = []): Promise<Element> {
  const view = await render(ComparisonComponent, {
    providers: [...catalogueProviders(BUNDLE), provideRouter(ANY_ROUTE), ...extra],
  });
  await catalogueReady();
  TestBed.inject(ComparisonState).set(slugs);
  view.fixture.detectChanges();
  return view.container;
}

describe('ComparisonComponent', () => {
  it('nennt die Arten als Köpfe der Spalten', async () => {
    const container = await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Gallenröhrling')).toBeInTheDocument();
    await noViolations(container);
  });

  it('stellt den Speisewert beider Arten nebeneinander', async () => {
    await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getByText('essbar')).toBeInTheDocument();
    expect(screen.getByText('ungenießbar')).toBeInTheDocument();
  });

  it('zeigt Hutbreite und die Notiz des Stiels aus dem Katalog', async () => {
    const container = await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getByText('Breite')).toBeInTheDocument();
    expect(container.querySelector('.compare__value')?.textContent).toContain('20');
    expect(screen.getByText('weiß, fein')).toBeInTheDocument();
  });

  it('nennt die Art der Fruchtschicht', async () => {
    await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getAllByText('Röhren')).toHaveLength(2);
  });

  it('zeigt die Wachstumszeit als Saison', async () => {
    await build(['steinpilz']);

    expect(screen.getByText('Zeit')).toBeInTheDocument();
    expect(screen.getByText('Mai – Nov.')).toBeInTheDocument();
  });

  it('lässt eine Zeile aus, für die keine Art einen Wert trägt', async () => {
    await build(['kahlkopf']);

    expect(screen.getByText('Kahlkopf')).toBeInTheDocument();
    expect(screen.queryByText('Breite')).not.toBeInTheDocument();
    expect(screen.queryByText('Zeit')).not.toBeInTheDocument();
  });

  it('blendet mit „nur Unterschiede“ eine gleiche Zeile aus', async () => {
    const view = await render(ComparisonComponent, {
      providers: [...catalogueProviders(BUNDLE), provideRouter(ANY_ROUTE)],
    });
    await catalogueReady();
    TestBed.inject(ComparisonState).set(['steinpilz', 'gallenroehrling']);
    view.fixture.detectChanges();

    expect(screen.getAllByText('Röhren')).toHaveLength(2);

    screen.getByRole('switch', { name: 'Nur Unterschiede' }).click();
    view.fixture.detectChanges();

    expect(screen.queryAllByText('Röhren')).toHaveLength(0);
  });

  it('nennt das Paar im Kopf, sobald das Fenster eine Spalte trägt', async () => {
    await build(['steinpilz', 'gallenroehrling'], [WIDE]);

    expect(screen.getByText('zwei Arten')).toBeInTheDocument();
  });

  it('bleibt ohne Wahl ohne Gruppen', async () => {
    const container = await build([]);

    expect(container.querySelector('.compare__group')).toBeNull();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const container = await build(['plain'], [EMPTY_CATALOG]);

    noGermanText(container);
  });
});
