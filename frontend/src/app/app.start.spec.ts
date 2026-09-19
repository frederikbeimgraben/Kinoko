import { TestBed } from '@angular/core/testing';
import { AuthService } from './core/auth';
import { ConfigService } from './core/config/config.service';
import { TextCatalogService } from './core/i18n/text-catalog.service';
import { ThemeService } from './core/theme/theme.service';
import { startApp } from './app.start';

/** Eine Ablage, die nie antwortet, und ein Katalog, der das meldet. */
class TextCatalogDouble {
  loaded = false;

  restore(): Promise<void> {
    return new Promise<void>(() => undefined);
  }

  load(): Promise<void> {
    this.loaded = true;
    return Promise.resolve();
  }
}

interface Calls {
  config: number;
  session: number;
}

function start(catalog: TextCatalogDouble, restoreSession = () => Promise.resolve()): Calls {
  TestBed.resetTestingModule();
  const calls: Calls = { config: 0, session: 0 };
  TestBed.configureTestingModule({
    providers: [
      { provide: ThemeService, useValue: { init: () => undefined } },
      {
        provide: AuthService,
        useValue: {
          restoreSession: () => {
            calls.session += 1;
            return restoreSession();
          },
        },
      },
      {
        provide: ConfigService,
        useValue: {
          load: () => {
            calls.config += 1;
            return new Promise<void>(() => undefined);
          },
        },
      },
      { provide: TextCatalogService, useValue: catalog },
    ],
  });
  TestBed.runInInjectionContext(startApp);
  return calls;
}

describe('startApp', () => {
  it('kehrt zurück, ohne auf Konfiguration oder Sitzung zu warten', () => {
    const calls = start(new TextCatalogDouble());

    expect(calls.config).toBe(1);
    expect(calls.session).toBe(1);
  });

  it('löst auf, ohne auf die Textablage zu warten', async () => {
    const catalog = new TextCatalogDouble();

    start(catalog);
    await Promise.resolve();

    expect(catalog.loaded).toBe(false);
  });

  it('holt den Katalog erst nach der Ablage', async () => {
    const catalog = new TextCatalogDouble();
    catalog.restore = () => Promise.resolve();

    start(catalog);

    await vi.waitFor(() => {
      expect(catalog.loaded).toBe(true);
    });
  });

  it('übergeht eine Ablage, die einen Fehler wirft', async () => {
    const catalog = new TextCatalogDouble();
    catalog.restore = () => Promise.reject(new Error('gesperrt'));

    start(catalog);

    await vi.waitFor(() => {
      expect(catalog.loaded).toBe(true);
    });
  });
});
