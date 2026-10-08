import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import {
  CATALOG_DE,
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  loadCatalog,
  type Locale,
  type TranslationKey,
} from './translations';

/** The built-in texts for each language. The service loads a missing language on demand. */
export type FallbackTexts = Readonly<Partial<Record<Locale, Readonly<Record<string, string>>>>>;

/** The built-in texts. A test can make them empty to see only keys. */
export const FALLBACK_TEXTS = new InjectionToken<FallbackTexts>('FALLBACK_TEXTS', {
  providedIn: 'root',
  factory: (): FallbackTexts => ({ de: CATALOG_DE }),
});

const STORAGE_KEY = 'pilzkarte.sprache';

/** Fixed start of the message, so that a test can find it. */
export const MISSING_KEY_PREFIX = 'i18n: fehlender Schlüssel';

/** Keys with these prefixes come from the server or an enum. A missing key here is not an error. */
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

/** German, English or the browser language. */
export type LanguageChoice = Locale | 'system';

/**
 * The texts from the database, one dictionary for each language. They use the keys of the built-in catalogue and override it.
 */
export type LoadedTexts = Readonly<Partial<Record<Locale, Readonly<Record<string, string>>>>>;

export const LANGUAGE_CHOICES: readonly LanguageChoice[] = ['de', 'en', 'system'];

/**
 * The UI language as a signal: German, English or the browser language. A saved choice wins over the browser. A missing key uses German. `TextCatalogService` loads the database texts and gives them with {@link useTexts}. The built-in catalogue is the offline fallback. This service does not load texts itself, because `ApiClient` needs this service for its error messages.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _fallback = signal<FallbackTexts>(inject(FALLBACK_TEXTS));
  private readonly _choice = signal<LanguageChoice>(this.read() ?? 'system');
  private readonly _locale = signal<Locale>(DEFAULT_LOCALE);
  private readonly _texts = signal<LoadedTexts>({});

  readonly choice = this._choice.asReadonly();
  /** The language with a loaded fallback. It changes after the load. */
  readonly locale = this._locale.asReadonly();
  readonly locales = SUPPORTED_LOCALES;

  /** The active dictionary, so that templates update on a language change. */
  readonly dictionary = computed<Record<string, string>>(() => ({
    ...this._fallback()[this.locale()],
    ...this._texts()[this.locale()],
  }));

  constructor() {
    void this.apply(this._choice());
  }

  /** Adds the table of a page with its own keys. */
  addFallback(more: Record<Locale, Record<string, string>>): this {
    this._fallback.update((known) =>
      Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, { ...known[locale], ...more[locale] }])),
    );
    return this;
  }

  /** Uses the texts from the database. They apply immediately. */
  useTexts(texts: LoadedTexts): void {
    this._texts.set(texts);
  }

  setChoice(choice: LanguageChoice): void {
    if (!LANGUAGE_CHOICES.includes(choice)) return;
    this._choice.set(choice);
    this.save(choice);
    void this.apply(choice);
  }

  /** Changes the language only after its fallback is loaded. */
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

  /** Translates a key. `{name}` comes from `params`. An unknown placeholder stays as it is. */
  translate(key: TranslationKey, params?: Record<string, string | number>): string {
    const known = this.lookup(key);
    if (known === null && !isDynamicKey(key)) console.error(`${MISSING_KEY_PREFIX} „${key}“`);
    const text = known ?? key;
    return params ? this.fill(text, params) : text;
  }

  /** Translates a free name that can also be no key. A missing key gives no message. */
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

  /** Sets the document language for screen readers and hyphenation. */
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
      // The browser can block storage. Then the browser language applies.
      return null;
    }
  }

  private save(choice: LanguageChoice): void {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      // Without storage, the choice applies only to this session.
    }
  }
}
