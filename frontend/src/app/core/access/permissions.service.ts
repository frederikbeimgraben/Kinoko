import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AccessApi } from '../api/access.api';
import type { Permission } from '../api/models';
import { AuthService } from '../auth';
import { OfflineStore } from '../offline/offline-store';

const KEY = 'mine';

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
  private readonly offline = inject(OfflineStore);

  private readonly held = signal<readonly Permission[] | null>(null);

  /** `null`, solange die Antwort aussteht. Dann zeigt die Oberfläche nichts. */
  readonly permissions = this.held.asReadonly();
  /**
   * Ob feststeht, was die Person darf. Beim Start läuft die stille Anmeldung
   * noch; solange sie läuft, ist „nicht angemeldet“ keine Antwort.
   */
  readonly settled = computed(() => this.held() !== null || (!this.auth.signedIn() && !this.auth.busy()));

  constructor() {
    effect(() => {
      // Ohne Anmeldung antwortet der Endpunkt mit 401. Die Abmeldung räumt die
      // Rechte weg, sonst bliebe die Verwaltung nach dem Abmelden sichtbar.
      if (this.auth.signedIn()) this.load();
      else {
        this.held.set(null);
        void this.offline.remove('permissions', KEY);
      }
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
    void this.restore();
    this.api.mine().subscribe({
      next: (answer) => {
        this.held.set(answer.permissions);
        void this.offline.put('permissions', KEY, answer.permissions);
      },
      // Ein Ausfall lässt die Rechte leer: lieber ein fehlender Punkt als ein
      // Knopf, der ins 403 läuft. Der Toast des ApiClient sagt schon Bescheid.
      error: () => {
        this.held.set(this.held() ?? []);
      },
    });
  }

  /** Die Rechte der letzten Antwort. Sie tragen vor der Antwort des Servers. */
  private async restore(): Promise<void> {
    const known = await this.offline.get<readonly Permission[]>('permissions', KEY);
    if (known !== null && this.held() === null) this.held.set(known);
  }
}
