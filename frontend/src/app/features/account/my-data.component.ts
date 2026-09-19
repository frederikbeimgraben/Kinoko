import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, CardComponent, ToastService } from '@stupa-makers/ui-kit';
import { AccessApi } from '../../core/api/access.api';
import type { AccountExport } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { OfflineStore } from '../../core/offline/offline-store';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { KeyValueRowComponent } from '../../ui/key-value-table/key-value-row.component';
import { KeyValueTableComponent } from '../../ui/key-value-table/key-value-table.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';

/** Heutiges Datum, so wie der Dateiname des Exports es braucht: `JJJJ-MM-TT`. */
function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** „Meine Daten“ unter dem Konto: Zähler, Export und vollständiges Löschen. */
@Component({
  selector: 'app-my-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    CardComponent,
    ConfirmDialogComponent,
    KeyValueRowComponent,
    KeyValueTableComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './my-data.component.html',
  styleUrl: './my-data.component.scss',
})
export class MyDataComponent {
  private readonly api = inject(AccessApi);
  private readonly i18n = inject(I18nService);
  private readonly offline = inject(OfflineStore);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  private readonly data = signal<AccountExport | null>(null);

  protected readonly asking = signal(false);
  protected readonly deleting = signal(false);

  protected readonly finds = computed(() => this.data()?.finds.length ?? 0);
  protected readonly markers = computed(() => this.data()?.markers.length ?? 0);
  protected readonly zones = computed(() => this.data()?.zones.length ?? 0);
  protected readonly photos = computed(() => this.data()?.photos.length ?? 0);
  protected readonly combinations = computed(() => this.data()?.combinations.length ?? 0);

  protected readonly meta = computed(() =>
    this.i18n.translate('account.deleteAllMeta', {
      finds: this.finds(),
      markers: this.markers(),
      zones: this.zones(),
      photos: this.photos(),
      combinations: this.combinations(),
    }),
  );

  constructor() {
    this.api.exportData().subscribe((data) => {
      this.data.set(data);
    });
  }

  protected back(): void {
    void this.router.navigateByUrl('/konto');
  }

  protected export(): void {
    const data = this.data();
    if (data === null) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `kinoko-export-${today()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  protected confirmDelete(): void {
    this.deleting.set(true);
    this.api.deleteData().subscribe({
      next: () => {
        void this.offline.clear('objects');
        void this.offline.clear('queue');
        this.deleting.set(false);
        this.asking.set(false);
        this.toasts.success(this.i18n.translate('account.deleteAllDone'));
        void this.router.navigateByUrl('/konto');
      },
      error: () => {
        this.deleting.set(false);
      },
    });
  }
}
