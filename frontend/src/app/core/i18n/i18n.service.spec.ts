import { TestBed } from '@angular/core/testing';
import { FALLBACK_TEXTS, I18nService } from './i18n.service';
import { CATALOG_DE, SUPPORTED_LOCALES, loadCatalog, type TranslationKey } from './translations';

/** Ein Dienst ohne jeden eingebauten Text. */
function withoutFallback(): I18nService {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: FALLBACK_TEXTS, useValue: { de: {}, en: {} } }],
  });
  return TestBed.inject(I18nService);
}

/**
 * Ein frischer Dienst je Test. Die Sprache wird beim Bauen gelesen; ohne
 * Schnitt trüge die Wahl aus dem vorigen Test in den nächsten.
 */
function service(): I18nService {
  TestBed.resetTestingModule();
  return TestBed.inject(I18nService);
}

/** Wartet auf den Rückfall der Sprache. Danach springt das Signal um. */
async function ready(i18n: I18nService, locale: 'de' | 'en'): Promise<void> {
  await vi.waitFor(() => {
    expect(i18n.locale()).toBe(locale);
  });
}

describe('I18nService', () => {
  it('führt Deutsch als Leitsprache', () => {
    expect(service().translate('nav.karte')).toBe('Karte');
    expect(document.documentElement.lang).toBe('de');
  });

  it('wechselt die Sprache und merkt sie sich', async () => {
    const i18n = service();

    i18n.setLocale('en');
    await ready(i18n, 'en');

    expect(i18n.locale()).toBe('en');
    expect(i18n.translate('nav.karte')).toBe('Map');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem('pilzkarte.sprache')).toBe('en');
  });

  it('lehnt eine unbekannte Sprache ab', () => {
    const i18n = service();

    i18n.setLocale('fr' as 'de');

    expect(i18n.locale()).toBe('de');
  });

  it('füllt Platzhalter und lässt unbekannte stehen', () => {
    const i18n = service();

    expect(i18n.translate('map.week.value', { week: 40, year: 2025 })).toBe('KW 40 · 2025');
    expect(i18n.translate('map.week.value', { week: 40 })).toBe('KW 40 · {year}');
  });

  it('nimmt die gesicherte Sprache beim Start', async () => {
    localStorage.setItem('pilzkarte.sprache', 'en');

    await ready(service(), 'en');
  });

  it('bleibt bei Deutsch, bis der englische Rückfall geladen ist', async () => {
    const i18n = service();

    i18n.setLocale('en');

    // Der Brocken kommt erst im nächsten Zug. Solange steht Deutsch da, nicht
    // der nackte Schlüssel.
    expect(i18n.locale()).toBe('de');
    expect(i18n.translate('nav.karte')).toBe('Karte');

    await ready(i18n, 'en');
    expect(i18n.translate('nav.karte')).toBe('Map');
  });

  it('folgt unter „System“ dem Browser und merkt sich die Wahl', () => {
    const i18n = service();

    i18n.setChoice('system');

    // Der Testbrowser steht auf de-DE, siehe `test-setup.ts`.
    expect(i18n.choice()).toBe('system');
    expect(i18n.locale()).toBe('de');
    expect(localStorage.getItem('pilzkarte.sprache')).toBe('system');
  });

  it('hält die Wahl gegen einen fremdsprachigen Browser', () => {
    localStorage.setItem('pilzkarte.sprache', 'de');
    Object.defineProperty(navigator, 'language', { configurable: true, get: () => 'en-GB' });

    // Ein englischer Browser machte aus der App sonst eine halb übersetzte
    // Seite: die Oberfläche englisch, der Artenkatalog deutsch.
    expect(service().locale()).toBe('de');
  });

  it('lehnt eine unbekannte Wahl ab', () => {
    const i18n = service();

    i18n.setChoice('fr' as 'de');

    expect(i18n.choice()).toBe('de');
  });

  it('fällt ohne saved Wahl auf die Browsersprache', async () => {
    localStorage.clear();
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');

    await ready(service(), 'en');
  });

  it('fällt bei unbekannter Browsersprache auf Deutsch', () => {
    localStorage.clear();
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');

    expect(service().locale()).toBe('de');
  });

  it('kommt ohne Speicher aus', async () => {
    const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });

    const i18n = service();
    i18n.setLocale('en');
    await ready(i18n, 'en');

    read.mockRestore();
    write.mockRestore();
  });

  it('gibt den Schlüssel zurück, wenn ihn kein Katalog kennt', () => {
    expect(service().translate('gibt.es.nicht' as TranslationKey)).toBe('gibt.es.nicht');
  });

  it('zeigt ohne Rückfalltabelle jeden Schlüssel als Schlüssel', () => {
    expect(withoutFallback().translate('nav.karte')).toBe('nav.karte');
  });

  it('kennt jeden Schlüssel in beiden Katalogen', async () => {
    const schluessel = Object.keys(CATALOG_DE);

    for (const locale of SUPPORTED_LOCALES) {
      const table = await loadCatalog(locale);
      expect(Object.keys(table)).toHaveLength(schluessel.length);
      for (const entry of schluessel) {
        expect(table[entry]).not.toBe('');
      }
    }
  });
});
