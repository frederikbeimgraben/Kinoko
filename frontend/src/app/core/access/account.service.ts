import { Injectable, effect, inject, signal } from '@angular/core';
import { AccessApi } from '../api/access.api';
import { AuthService } from '../auth';

/** Die Kennung des eigenen Kontos, für den Abgleich gegen `ownerId`. */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly api = inject(AccessApi);
  private readonly auth = inject(AuthService);

  private readonly held = signal<string | null>(null);

  constructor() {
    effect(() => {
      if (this.auth.signedIn()) this.load();
      else this.held.set(null);
    });
  }

  /** Sagt, ob die angemeldete Person das Konto hinter `ownerId` ist. */
  owns(ownerId: string | null): boolean {
    return ownerId !== null && ownerId === this.held();
  }

  private load(): void {
    this.api.me({ quiet: true }).subscribe({
      next: (me) => {
        this.held.set(me.id);
      },
      error: () => {
        this.held.set(null);
      },
    });
  }
}
