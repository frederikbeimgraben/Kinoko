import { DOCUMENT, ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { grouped } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { ButtonComponent } from '../../ui/button/button.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { FormSheetComponent } from '../../ui/form-sheet/form-sheet.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ToastService } from '../../ui/toast/toast.service';
import { SpeciesStore } from '../species/species.store';
import { AccountStatsComponent } from './account-stats.component';
import { DataExportBodyComponent } from './data-export-body.component';
import { exportDay, saveFile } from './download';
import { exportFile, partsFor, selected, type ExportFormat, type ExportPart } from './export-files';
import { MyDataStore } from './my-data.store';

/** The parts that the sheet selects first, per `DataExportBody.dc.html`. */
const FIRST_PARTS: ReadonlySet<ExportPart> = new Set<ExportPart>(['finds', 'markers', 'zones']);

/** "My data" below the account, per `MyData.dc.html`: counts, export and a full delete. */
@Component({
  selector: 'app-my-data',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccountStatsComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    DataExportBodyComponent,
    FormSheetComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    TranslatePipe,
  ],
  templateUrl: './my-data.component.html',
  styleUrl: './account-page.scss',
})
export class MyDataComponent {
  private readonly document = inject(DOCUMENT);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly species = inject(SpeciesStore);
  private readonly store = inject(MyDataStore);
  private readonly toasts = inject(ToastService);
  private readonly wide = inject(ViewportService).wide;

  protected readonly back = computed(() => !this.wide());
  protected readonly counts = this.store.counts;
  protected readonly deleting = this.store.deleting;

  protected readonly exporting = signal(false);
  protected readonly asking = signal(false);
  protected readonly format = signal<ExportFormat>('json');
  protected readonly parts = signal<ReadonlySet<ExportPart>>(FIRST_PARTS);

  /** The counts in the question of the delete dialog, per `DeleteAll.dc.html`. */
  protected readonly meta = computed(() => {
    const counts = this.counts();
    return counts === null
      ? ''
      : this.i18n.translate('account.deleteAllCount', {
          finds: grouped(counts.finds),
          markers: grouped(counts.markers),
          zones: grouped(counts.zones),
          photos: grouped(counts.photos),
        });
  });

  protected toggle(part: ExportPart): void {
    this.parts.update((parts) =>
      parts.has(part) ? new Set([...parts].filter((one) => one !== part)) : new Set([...parts, part]),
    );
  }

  protected export(): void {
    const data = this.store.data();
    if (data === null) return;
    const format = this.format();
    const allowed = new Set(partsFor(format).filter((part) => this.parts().has(part)));
    const name = (id: string | null | undefined): string =>
      id ? (this.species.entryById(id)?.name ?? '') : '';
    saveFile(exportFile(selected(data, allowed), format, name, exportDay(new Date())), this.document);
    this.exporting.set(false);
  }

  protected async confirmDelete(): Promise<void> {
    if (!(await this.store.deleteAll())) return;
    this.asking.set(false);
    this.toasts.success(this.i18n.translate('account.deleteAllDone'));
    void this.router.navigateByUrl('/konto');
  }

  protected toAccount(): void {
    void this.router.navigateByUrl('/konto');
  }
}
