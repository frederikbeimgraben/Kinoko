import { computed, signal, type Provider } from '@angular/core';
import { I18nService } from '../core/i18n/i18n.service';

/** Ein Katalog ohne Texte: jeder Schlüssel steht für sich selbst. */
const emptyService = {
  choice: signal('de').asReadonly(),
  locale: signal('de').asReadonly(),
  locales: ['de', 'en'] as const,
  dictionary: computed<Record<string, string>>(() => ({})),
  useTexts: () => undefined,
  setChoice: () => undefined,
  setLocale: () => undefined,
  translate: (key: string) => key,
};

export const EMPTY_CATALOG: Provider = {
  provide: I18nService,
  useValue: emptyService,
};

const GERMAN_WORDS =
  /(?<![A-Za-zÄÖÜäöüß])(der|die|das|den|dem|des|ein|eine|und|oder|nicht|kein|keine|mit|ohne|für|von|zu|auf|aus|im|am|bei|nach|vor|über|unter|Arten|Farbe|Woche|Karte|Fund|Bild|Zeile|Knopf)(?![A-Za-zÄÖÜäöüß])/;

const UMLAUT = /[äöüÄÖÜß]/;

/** Wirft, wenn ein deutsches Wort im Baum steht. Texte kommen aus Schlüsseln. */
export function noGermanText(element: Element): void {
  const parts = [element.textContent];
  for (const node of element.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
    for (const name of ['aria-label', 'title', 'placeholder', 'alt']) {
      parts.push(node.getAttribute(name) ?? '');
    }
  }
  const text = parts.join(' ');
  const word = GERMAN_WORDS.exec(text);
  if (word) throw new Error(`Deutsches Wort ohne Schlüssel: ${word[1]}`);
  if (UMLAUT.test(text)) throw new Error(`Umlaut ohne Schlüssel: ${text.slice(0, 80)}`);
}
