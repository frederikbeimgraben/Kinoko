import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AccessApi } from '../api/access.api';
import type { Permission } from '../api/models';
import { AuthService, SessionState, SessionStore } from '../auth';

/**
 * Die eigenen Rechte als Signal.
 *
 * Sie kommen einmal je Anmeldung von `/api/me/permissions` und blenden in der
 * Oberfläche Punkte und Knöpfe aus. Entschieden wird damit nichts: jede Route
 * des Servers prüft ihr Recht selbst. Wer hier lügt, bekommt vom Dienst ein
 * 403 statt einer Wirkung.
 */
@Injectable({ providedIn: 'root' })
export class PermissionsService {
  private readonly api = inject(AccessApi);
  private readonly auth = inject(AuthService);
  private readonly session = inject(SessionState);
  private readonly store = inject(SessionStore);

  private readonly held = signal<readonly Permission[] | null>(this.store.memory()?.permissions ?? null);

  /** `null`, solange die Antwort aussteht. Dann zeigt die Oberfläche nichts. */
  readonly permissions = this.held.asReadonly();
  /** Ob feststeht, was die Person darf. Der Stand aus dem Gerät zählt mit. */
  readonly settled = computed(() => this.held() !== null || this.session.status() === 'guest');

  constructor() {
    effect(() => {
      // Ohne Anmeldung antwortet der Endpunkt mit 401. Die Abmeldung räumt die
      // Rechte weg, sonst bliebe die Verwaltung nach dem Abmelden sichtbar.
      if (this.auth.signedIn()) this.load();
      else if (this.session.status() === 'guest') this.held.set(null);
    });
  }

  can(permission: Permission): boolean {
    return this.held()?.includes(permission) ?? false;
  }

  /** Ob die Person überhaupt einen Punkt der Verwaltung sieht. */
  canAny(permissions: readonly Permission[]): boolean {
    return permissions.some((permission) => this.can(permission));
  }

  private load(): void {
    this.api.mine().subscribe({
      next: (answer) => {
        this.held.set(answer.permissions);
        this.store.keep({ permissions: answer.permissions });
      },
      // Ein Ausfall lässt die Rechte leer: lieber ein fehlender Punkt als ein
      // Knopf, der ins 403 läuft. Der Toast des ApiClient sagt schon Bescheid.
      error: () => {
        this.held.set(this.held() ?? []);
      },
    });
  }
}
