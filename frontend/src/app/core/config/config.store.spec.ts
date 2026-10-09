import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { patchState } from '@ngrx/signals';
import { unprotected } from '@ngrx/signals/testing';
import { setFailed } from '../state';
import { ConfigStore, type AppConfig } from './config.store';

const CONFIG: AppConfig = {
  oidcIssuer: 'https://sso.example.org/application/o/pilzkarte/',
  oidcName: 'Example SSO',
  oidcClientId: 'pilzkarte',
  origin: 'https://pilze.example.org',
  version: '2026-09-09',
};

function build(): { config: ConfigStore; http: HttpTestingController } {
  TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
  return { config: TestBed.inject(ConfigStore), http: TestBed.inject(HttpTestingController) };
}

describe('ConfigStore', () => {
  it('reads nothing before the first load', () => {
    const { config, http } = build();

    expect(config.status()).toBe('idle');
    expect(config.settled()).toBe(false);
    http.expectNone('/api/config');
  });

  it('reads the five fields', async () => {
    const { config, http } = build();

    const loaded = config.load();
    expect(config.loading()).toBe(true);
    http.expectOne('/api/config').flush(CONFIG);
    await loaded;

    expect(config.configuration()).toEqual(CONFIG);
    expect(config.settled()).toBe(true);
  });

  it('stays empty without a backend and does not stop the start', async () => {
    const { config, http } = build();

    const loaded = config.load();
    http.expectOne('/api/config').error(new ProgressEvent('error'), { status: 0 });
    await loaded;

    expect(config.configuration()).toBeNull();
    expect(config.failed()).toBe(true);
    expect(config.settled()).toBe(true);
  });

  it('reads again after a failure, so a later sign-in can work', async () => {
    const { config, http } = build();

    const first = config.load();
    http.expectOne('/api/config').error(new ProgressEvent('error'), { status: 0 });
    await first;
    expect(config.failed()).toBe(true);

    const second = config.load();
    http.expectOne('/api/config').flush(CONFIG);
    await second;

    expect(config.configuration()).toEqual(CONFIG);
    expect(config.providerName()).toBe('Example SSO');
  });

  it('names the SSO by its host when the backend sends no name', async () => {
    const { config, http } = build();

    const loaded = config.load();
    http.expectOne('/api/config').flush({ ...CONFIG, oidcName: '' });
    await loaded;

    expect(config.providerName()).toBe('sso.example.org');
    expect(config.ssoMissing()).toBe(false);
  });

  it('knows a backend without an SSO', async () => {
    const { config, http } = build();

    const loaded = config.load();
    http.expectOne('/api/config').flush({ ...CONFIG, oidcIssuer: '', oidcName: '' });
    await loaded;

    expect(config.ssoMissing()).toBe(true);
    expect(config.providerName()).toBe('');
  });

  it('reads one time for all callers', async () => {
    const { config, http } = build();

    const both = Promise.all([config.load(), config.load()]);
    http.expectOne('/api/config').flush(CONFIG);
    await both;
    await config.load();

    http.expectNone('/api/config');
    expect(config.configuration()).toEqual(CONFIG);
  });

  it('counts a failed state as settled', () => {
    const { config } = build();

    patchState(unprotected(config), setFailed());

    expect(config.settled()).toBe(true);
  });
});
