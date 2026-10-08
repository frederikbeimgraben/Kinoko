import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ConfigStore, type AppConfig } from './config.store';

const CONFIG: AppConfig = {
  oidcIssuer: 'https://sso.beimgraben.net/application/o/pilzkarte/',
  oidcClientId: 'pilzkarte',
  origin: 'https://pilze.beimgraben.net',
  version: '2026-09-09',
};

function build(): { config: ConfigStore; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  const config = TestBed.inject(ConfigStore);
  TestBed.tick();
  return { config, http: TestBed.inject(HttpTestingController) };
}

describe('ConfigStore', () => {
  it('reads the four fields when it starts', async () => {
    const { config, http } = build();
    const loaded = config.load();

    http.expectOne('/api/config').flush(CONFIG);
    TestBed.tick();
    await loaded;

    expect(config.configuration()).toEqual(CONFIG);
    expect(config.settled()).toBe(true);
  });

  it('waits while the read is open', () => {
    const { config, http } = build();

    expect(config.settled()).toBe(false);
    expect(config.configuration()).toBeNull();
    http.expectOne('/api/config');
  });

  it('stays empty without a backend and does not stop the start', async () => {
    const { config, http } = build();
    const loaded = config.load();

    http.expectOne('/api/config').error(new ProgressEvent('error'), { status: 0 });
    TestBed.tick();
    await loaded;

    expect(config.configuration()).toBeNull();
    expect(config.settled()).toBe(true);
  });

  it('reads one time for all callers', async () => {
    const { config, http } = build();
    const both = Promise.all([config.load(), config.load()]);

    http.expectOne('/api/config').flush(CONFIG);
    TestBed.tick();
    await both;

    http.expectNone('/api/config');
  });
});
