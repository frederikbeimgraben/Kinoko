import { Location } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

/** Goes back from a subpage without a loop in the history. */
@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  /** Goes one step back. Without app history, `fallback` replaces the entry. */
  back(fallback: readonly string[]): void {
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
      return;
    }
    void this.router.navigate([...fallback], { replaceUrl: true });
  }
}
