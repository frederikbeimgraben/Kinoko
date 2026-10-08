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

/** Without fallback table and catalogue, the UI shows only keys. */
const EMPTY = [
  { provide: FALLBACK_TEXTS, useValue: { de: {}, en: {} } },
  { provide: WORKSHOP_TEXTS, useValue: { de: {}, en: {} } },
];

const KEY = /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+[:.,]?$/;

/** Short texts such as „cm“ or „%“ also match numbers and units. */
const LONG_ENOUGH = 4;

@Component({
  selector: 'app-blank-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
class BlankPageComponent {}

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

/** A German-looking word that is not a key is hard-coded text. */
function germanWords(container: Element): string[] {
  return words(container).filter((word) => !KEY.test(word) && isGerman(word));
}

/** Month and weekday names come from Intl, not from the catalogue. */
function localeNames(): Set<string> {
  const months = new Intl.DateTimeFormat('de', { month: 'long' });
  const weekdays = new Intl.DateTimeFormat('de', { weekday: 'long' });
  const found = new Set<string>();
  for (let at = 0; at < 12; at += 1) found.add(months.format(new Date(Date.UTC(2000, at, 1))));
  for (let day = 2; day <= 8; day += 1) found.add(weekdays.format(new Date(Date.UTC(2000, 0, day))));
  return found;
}

const FROM_LOCALE = localeNames();

/** Default texts that the UI shows. Keys do not count. */
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
      // This test does not use the observer.
    }

    unobserve(): void {
      // The stub does not track targets.
    }

    disconnect(): void {
      // The stub has nothing to clean up.
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
