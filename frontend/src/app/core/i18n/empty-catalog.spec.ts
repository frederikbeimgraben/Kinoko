import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render } from '@testing-library/angular';
import { isGerman } from '../../../../tools/check-german.mjs';
import { BuildingBlocksComponent } from '../../dev/building-blocks/building-blocks.component';
import { WORKSHOP_TEXTS } from './workshop-texts';
import { ShellComponent } from '../../shell/shell.component';
import { ManagerDouble, authProvider } from '../../testing/auth-double';
import { FALLBACK_TEXTS } from './i18n.service';
import generated from './texts.de.json';

/** Ohne Rückfalltabelle und ohne Katalog trägt die Oberfläche nur Schlüssel. */
const EMPTY = [
  { provide: FALLBACK_TEXTS, useValue: { de: {}, en: {} } },
  { provide: WORKSHOP_TEXTS, useValue: { de: {}, en: {} } },
];

const KEY = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+[:.,]?$/;

/** Kurze Texte wie „cm“ oder „%“ treffen auch auf Zahlen und Einheiten zu. */
const LONG_ENOUGH = 4;

@Component({
  selector: 'app-blank-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class BlankPageComponent {}

/** Jedes Wort, das die Fläche zeigt. */
function words(container: Element): string[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const found: string[] = [];
  let node = walker.nextNode();
  while (node !== null) {
    found.push(...(node.textContent ?? '').split(/\s+/).filter((word) => word.length > 0));
    node = walker.nextNode();
  }
  return found;
}

/** Ein Wort, das kein Schlüssel ist und deutsch aussieht, steht fest im Code. */
function germanWords(container: Element): string[] {
  return words(container).filter((word) => !KEY.test(word) && isGerman(word));
}

/** Monats- und Wochentagsnamen kommen aus der Datumsform, nicht aus dem Katalog. */
function localeNames(): Set<string> {
  const months = new Intl.DateTimeFormat('de', { month: 'long' });
  const weekdays = new Intl.DateTimeFormat('de', { weekday: 'long' });
  const found = new Set<string>();
  for (let at = 0; at < 12; at += 1) found.add(months.format(new Date(Date.UTC(2000, at, 1))));
  for (let day = 2; day <= 8; day += 1) found.add(weekdays.format(new Date(Date.UTC(2000, 0, day))));
  return found;
}

const FROM_LOCALE = localeNames();

/** Ein Text der Vorgabe auf der Fläche. Ein Schlüssel zählt nicht mit. */
function leakedTexts(container: Element): string[] {
  const shown = words(container)
    .filter((word) => !KEY.test(word))
    .join(' ');
  return [...new Set(Object.values(generated))].filter(
    (value) => !FROM_LOCALE.has(value) && value.length >= LONG_ENOUGH && shown.includes(value),
  );
}

describe('Die Hülle ohne Textkatalog', () => {
  it('zeigt kein deutsches Wort und keinen Text der Vorgabe', async () => {
    const { container, navigate } = await render(ShellComponent, {
      providers: [
        provideRouter([{ path: 'karte', component: BlankPageComponent }]),
        ...authProvider(new ManagerDouble()),
        ...EMPTY,
      ],
    });
    await navigate('/karte');

    expect(germanWords(container)).toEqual([]);
    expect(leakedTexts(container)).toEqual([]);
  });
});

describe('Die Werkstattseite ohne Textkatalog', () => {
  class ObserverStub {
    observe(): void {
      // Der Fühler bleibt in diesem Test ungenutzt.
    }

    unobserve(): void {
      // Der Stummel braucht keine Buchführung über das Ziel.
    }

    disconnect(): void {
      // Der Stummel räumt nichts auf.
    }
  }

  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', ObserverStub);
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:eins', revokeObjectURL: () => undefined });
  });

  it('zeigt kein deutsches Wort und keinen Text der Vorgabe', async () => {
    const { container } = await render(BuildingBlocksComponent, {
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ...EMPTY],
    });

    expect(germanWords(container)).toEqual([]);
    expect(leakedTexts(container)).toEqual([]);
  });
});
