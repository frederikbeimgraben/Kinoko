import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

/** Der Weg zurück von einer Unterseite, ohne Schleife im Verlauf. */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Geht einen Schritt zurück. Ohne eigenen Verlauf ersetzt `fallback` den Eintrag. */
  back(fallback: readonly string[]): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
      return;
    }
    void this.router.navigate([...fallback], { replaceUrl: true });
  }
}
