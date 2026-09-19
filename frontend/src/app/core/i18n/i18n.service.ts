import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import {
  CATALOG_DE,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  loadCatalog,
  type Locale,
  type TranslationKey,
} from './translations';

/** Die eingebauten Texte je Sprache. Eine fehlende Sprache wird nachgeladen. */
export type FallbackTexts = Readonly<Partial<Record<Locale, Readonly<Record<string, string>>>>>;

/** Die eingebauten Texte. Ein Test setzt sie leer und sieht nur Schlüssel. */
export const FALLBACK_TEXTS = new InjectionToken<FallbackTexts>('FALLBACK_TEXTS', {
  providedIn: 'root',
  factory: (): FallbackTexts => ({ de: CATALOG_DE }),
});

const STORAGE_KEY = 'pilzkarte.sprache';

/** Fester Anfang der Meldung, damit ein Test sie erkennt. */
export const MISSING_KEY_PREFIX = 'i18n: fehlender Schlüssel';

/** Diese Präfixe kommen vom Server oder aus einer Aufzählung, eine Lücke darin ist kein Fehler. */
const DYNAMIC_KEY_PREFIXES: readonly string[] = [
  'account.mapApp.',
  'enum.',
  'farbe.',
  'layer.',
  'map.tab.',
  'marker.',
  'melden.',
  'sichtbarkeit.',
  'sprache.',
  'theme.',
  'zone.',
];

function isDynamicKey(key: string): boolean {
  return DYNAMIC_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

/** Deutsch, Englisch oder das, was der Browser sagt. */
export type LanguageChoice = Locale | 'system';

/**
 * Die Texte aus der Datenbank, je Sprache ein Wörterbuch. Sie tragen dieselben
 * Schlüssel wie der eingebaute Katalog und stechen ihn aus.
 */
export type LoadedTexts = Readonly<Partial<Record<Locale, Readonly<Record<string, string>>>>>;

export const LANGUAGE_CHOICES: readonly LanguageChoice[] = ['de', 'en', 'system'];

/**
 * Die Sprache der Oberfläche als Signal.
 *
 * Gewählt wird zwischen Deutsch, Englisch und dem Browser. Ohne Wahl führt der
 * Browser, wie vorher auch. Wer die Wahl trifft, behält sie: ein englischer
 * Browser macht aus der App sonst eine halb übersetzte Seite, weil die Texte
 * des Artenkatalogs deutsch bleiben. Fehlt ein Schlüssel in der aktiven
 * Sprache, greift Deutsch.
 *
 * Die Texte selbst stehen in der Datenbank. `TextCatalogService` holt sie und
 * reicht sie mit {@link useTexts} herein; der eingebaute Katalog bleibt der
 * Rückfall für den ersten Start und für den Betrieb ohne Netz. Der Dienst holt
 * sie nicht selbst: der Weg dorthin führt über den `ApiClient`, und der
 * braucht wiederum diesen Dienst für seine Fehlermeldungen.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _fallback = signal<FallbackTexts>(inject(FALLBACK_TEXTS));
  private readonly _choice = signal<LanguageChoice>(this.read() ?? 'system');
  private readonly _locale = signal<Locale>(DEFAULT_LOCALE);
  private readonly _texts = signal<LoadedTexts>({});

  readonly choice = this._choice.asReadonly();
  /** Die Sprache, deren Rückfall schon da ist. Sie wechselt nach dem Laden. */
  readonly locale = this._locale.asReadonly();
  readonly locales = SUPPORTED_LOCALES;

  /** Das aktive Wörterbuch, damit Vorlagen auf den Wechsel reagieren. */
  readonly dictionary = computed<Record<string, string>>(() => ({
    ...this._fallback()[this.locale()],
    ...this._texts()[this.locale()],
  }));

  constructor() {
    void this.apply(this._choice());
  }

  /** Nimmt die Tabelle einer Seite mit eigenen Schlüsseln dazu. */
  addFallback(more: Record<Locale, Record<string, string>>): this {
    this._fallback.update((known) =>
      Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, { ...known[locale], ...more[locale] }])),
    );
    return this;
  }

  /** Übernimmt die Texte aus der Datenbank. Sie wirken sofort. */
  useTexts(texts: LoadedTexts): void {
    this._texts.set(texts);
  }

  setChoice(choice: LanguageChoice): void {
    if (!LANGUAGE_CHOICES.includes(choice)) return;
    this._choice.set(choice);
    this.save(choice);
    void this.apply(choice);
  }

  /** Die Sprache wechselt erst, wenn ihr Rückfall da ist. */
  private async apply(choice: LanguageChoice): Promise<void> {
    const wanted = choice === 'system' ? this.browserLanguage() : choice;
    if (this._fallback()[wanted] === undefined) {
      const table = await loadCatalog(wanted);
      this._fallback.update((known) => ({ ...known, [wanted]: { ...table, ...known[wanted] } }));
    }
    this._locale.set(wanted);
    this.flip();
  }

  setLocale(locale: Locale): void {
    this.setChoice(locale);
  }

  /** Übersetzt einen Schlüssel. `{name}` kommt aus `params`, sonst steht er da. */
  translate(key: TranslationKey, params?: Record<string, string | number>): string {
    const known = this.lookup(key);
    if (known === null && !isDynamicKey(key)) console.error(`${MISSING_KEY_PREFIX} „${key}“`);
    const text = known ?? key;
    return params ? this.fill(text, params) : text;
  }

  /** Übersetzt einen freien Namen, der auch kein Schlüssel sein darf: keine Meldung, wenn er fehlt. */
  translateOptional(name: string): string {
    return this.lookup(name) ?? name;
  }

  private lookup(key: string): string | null {
    const german = this._fallback()[DEFAULT_LOCALE]?.[key] ?? '';
    return this.dictionary()[key] || german || null;
  }

  private fill(text: string, params: Record<string, string | number>): string {
    return text.replace(/\{(\w+)\}/g, (matches, name: string) =>
      name in params ? String(params[name]) : matches,
    );
  }

  /** Das Dokument trägt die Sprache, für Vorleser und für die Silbentrennung. */
  private flip(): void {
    document.documentElement.lang = this.locale();
  }

  private browserLanguage(): Locale {
    const browser = navigator.language.slice(0, 2).toLowerCase();
    return this.isLocale(browser) ? browser : DEFAULT_LOCALE;
  }

  private isLocale(value: string): value is Locale {
    return (SUPPORTED_LOCALES as readonly string[]).includes(value);
  }

  private isChoice(value: string): value is LanguageChoice {
    return (LANGUAGE_CHOICES as readonly string[]).includes(value);
  }

  private read(): LanguageChoice | null {
    try {
      const value = localStorage.getItem(STORAGE_KEY);
      return value !== null && this.isChoice(value) ? value : null;
    } catch {
      // Der Browser kann den Speicher sperren. Dann führt die Browsersprache.
      return null;
    }
  }

  private save(choice: LanguageChoice): void {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Ohne Speicher bleibt die Wahl nur für diese Sitzung.
    }
  }
}
