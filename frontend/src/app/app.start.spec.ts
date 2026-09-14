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

function start(catalog: TextCatalogDouble, restoreSession = () => Promise.resolve()): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: ThemeService, useValue: { init: () => undefined } },
      { provide: AuthService, useValue: { restoreSession } },
      { provide: ConfigService, useValue: { load: () => Promise.resolve() } },
      { provide: TextCatalogService, useValue: catalog },
    ],
  });
  return TestBed.runInInjectionContext(startApp);
}

describe('startApp', () => {
  it('löst auf, ohne auf die Textablage zu warten', async () => {
    const catalog = new TextCatalogDouble();

    await start(catalog);

    expect(catalog.loaded).toBe(false);
  });

  it('holt den Katalog erst nach der Ablage', async () => {
    const catalog = new TextCatalogDouble();
    catalog.restore = () => Promise.resolve();

    await start(catalog);
    await Promise.resolve();

    expect(catalog.loaded).toBe(true);
  });

  it('übergeht eine Ablage, die einen Fehler wirft', async () => {
    const catalog = new TextCatalogDouble();
    catalog.restore = () => Promise.reject(new Error('gesperrt'));

    await start(catalog);
    await Promise.resolve();

    expect(catalog.loaded).toBe(true);
  });
});
