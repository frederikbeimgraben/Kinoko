import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../api/api-client';

/** Was das Backend über sich und die Anmeldung verrät. `GET /api/config`. */
export interface AppConfig {
  oidcIssuer: string;
  oidcClientId: string;
  origin: string;
  version: string;
}

/**
 * Die Konfiguration wird einmal beim Start geholt. Sie steht danach als Signal
 * bereit, damit die Anmeldung in E1 ohne eigenen Ladeweg auskommt.
 */
@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly api = inject(ApiClient);
  private readonly _configuration = signal<AppConfig | null>(null);
  private pending: Promise<void> | null = null;

  readonly configuration = this._configuration.asReadonly();

  /** Holt die Konfiguration genau einmal. Jeder Aufrufer teilt die Antwort. */
  load(): Promise<void> {
    this.pending ??= this.fetch();
    return this.pending;
  }

  /**
   * Ein Fehler bleibt hier stumm: Karte, Arten und Ebenen laufen ohne Backend,
   * und der ApiClient hat den Fehler schon als Toast gezeigt.
   */
  private async fetch(): Promise<void> {
    try {
      this._configuration.set(await firstValueFrom(this.api.get<AppConfig>('/config')));
    } catch {
      this._configuration.set(null);
    }
  }
}
