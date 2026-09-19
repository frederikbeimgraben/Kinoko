import { Injectable, computed, effect, inject } from '@angular/core';
import { AuthService } from './auth.service';
import { SessionStore } from './session.store';

/** Drei Werte: offen, ohne Konto, mit Konto. „Offen“ ist nicht „ohne Konto“. */
export type SessionStatus = 'unknown' | 'guest' | 'signedIn';

/** Die Sitzung für die Oberfläche. Ein Stand im Gerät gilt sofort. */
@Injectable({ providedIn: 'root' })
export class SessionState {
  private readonly auth = inject(AuthService);
  private readonly store = inject(SessionStore);

  readonly status = computed<SessionStatus>(() => {
    if (this.auth.signedIn()) return 'signedIn';
    if (this.auth.checked()) return 'guest';
    return this.store.memory() === null ? 'unknown' : 'signedIn';
  });

  /** Der Name für den Kreis: aus der Sitzung oder aus dem Gerät. */
  readonly name = computed<string | null>(() => {
    if (this.status() !== 'signedIn') return null;
    return this.auth.user()?.name ?? this.store.memory()?.name ?? null;
  });

  constructor() {
    effect(() => {
      const person = this.auth.user();
      if (person !== null) this.store.keep({ name: person.name });
      else if (this.auth.checked()) this.store.forget();
    });
  }
}
