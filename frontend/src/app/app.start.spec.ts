import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService, SessionStore } from './core/auth';
import { ConfigStore } from './core/config/config.store';
import { TextCatalogService } from './core/i18n/text-catalog.service';
import { ThemeStore } from './core/theme/theme.store';
import { startApp } from './app.start';

/** A local copy that never answers, and a catalogue that records the load. */
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
  theme: number;
  config: number;
  session: number;
}

function start(catalog: TextCatalogDouble, restoreSession = () => Promise.resolve()): Calls {
  TestBed.resetTestingModule();
  const calls: Calls = { theme: 0, config: 0, session: 0 };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: ThemeStore,
        useFactory: () => {
          calls.theme += 1;
          return {};
        },
      },
      {
        provide: ConfigStore,
        useValue: {
          load: () => {
            calls.config += 1;
            return new Promise<void>(() => undefined);
          },
        },
      },
      {
        provide: AuthService,
        useValue: {
          restoreSession: () => {
            calls.session += 1;
            return restoreSession();
          },
        },
      },
      { provide: TextCatalogService, useValue: catalog },
      { provide: SessionStore, useValue: { status: signal('unknown') } },
    ],
  });
  TestBed.runInInjectionContext(startApp);
  return calls;
}

describe('startApp', () => {
  it('starts the theme, the configuration and the session without a wait', () => {
    const calls = start(new TextCatalogDouble());

    expect(calls.theme).toBe(1);
    expect(calls.config).toBe(1);
    expect(calls.session).toBe(1);
  });

  it('resolves without a wait for the local text copy', async () => {
    const catalog = new TextCatalogDouble();

    start(catalog);
    await Promise.resolve();

    expect(catalog.loaded).toBe(false);
  });

  it('loads the catalogue after the local copy', async () => {
    const catalog = new TextCatalogDouble();
    catalog.restore = () => Promise.resolve();

    start(catalog);

    await vi.waitFor(() => {
      expect(catalog.loaded).toBe(true);
    });
  });

  it('ignores a local copy that throws an error', async () => {
    const catalog = new TextCatalogDouble();
    catalog.restore = () => Promise.reject(new Error('blocked'));

    start(catalog);

    await vi.waitFor(() => {
      expect(catalog.loaded).toBe(true);
    });
  });
});
