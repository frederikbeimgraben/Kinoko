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
const DARK_PINK = { name: 'dunkelrosa', hex: '#d9a0ac' };
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
  traits: [{ key: 'stem', text: 'weiss, fein' }],
  terms: [{ term: { id: 'a', slug: 'mild', name: 'mild', kind: 'taste' }, fromExperience: false }],
});

const GALL = speciesEntry({
  slug: 'gallenroehrling',
  name: 'Gallenröhrling',
  scientificName: 'Tylopilus felleus',
  edibility: 'inedible',
  colours: [{ part: 'tubes', mode: 'single', colours: [PINK] }],
  colourChanges: [
    { part: 'tubes', kind: 'mechanical', from: PINK, to: DARK_PINK, speed: '1min', triggers: [] },
  ],
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

/** Der Text einer Zelle, die es geben muss. */
function textOf(container: Element, selector: string): string {
  return container.querySelector(selector)?.textContent ?? '';
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

  it('zeigt Hutbreite, Stielnetz und Geschmack aus dem Katalog', async () => {
    const container = await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getByText('Hutbreite')).toBeInTheDocument();
    expect(textOf(container, '.compare__measure')).toContain('20');
    expect(screen.getByText('weiss, fein')).toBeInTheDocument();
    expect(screen.getByText('mild')).toBeInTheDocument();
  });

  it('nennt die Fruchtschicht mit dem Namen ihres Teils', async () => {
    await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getByText('Röhren')).toBeInTheDocument();
  });

  it('zeigt die Druckprobe mit Dauer, sonst als bleibend', async () => {
    await build(['steinpilz', 'gallenroehrling']);

    expect(screen.getByText('Druckprobe')).toBeInTheDocument();
    expect(screen.getByText('nach 1 min')).toBeInTheDocument();
    expect(screen.getByText('bleibt')).toBeInTheDocument();
  });

  it('zeigt die Wachstumszeit als Band', async () => {
    const container = await build(['steinpilz']);

    expect(screen.getByText('Zeit')).toBeInTheDocument();
    expect(container.querySelector('app-year-band')).not.toBeNull();
  });

  it('lässt eine Zeile aus, für die keine Art einen Wert trägt', async () => {
    await build(['kahlkopf']);

    expect(screen.getByText('Kahlkopf')).toBeInTheDocument();
    expect(screen.queryByText('Hutbreite')).not.toBeInTheDocument();
    expect(screen.queryByText('Stielnetz')).not.toBeInTheDocument();
    expect(screen.queryByText('Zeit')).not.toBeInTheDocument();
  });

  it('nennt das Paar im Kopf, sobald das Fenster eine Spalte trägt', async () => {
    await build(['steinpilz', 'gallenroehrling'], [WIDE]);

    expect(screen.getByText('zwei Arten')).toBeInTheDocument();
  });

  it('bleibt ohne Wahl ohne Tabelle', async () => {
    const container = await build([]);

    expect(container.querySelector('app-key-value-table')).toBeNull();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const container = await build(['plain'], [EMPTY_CATALOG]);

    noGermanText(container);
  });
});
