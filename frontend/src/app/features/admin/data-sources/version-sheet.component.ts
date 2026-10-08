import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import type { DataSourceVersion } from '../../../core/api/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../../core/i18n/translations';
import { ConfirmDialogComponent } from '../../../ui/confirm-dialog/confirm-dialog.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { MonoComponent } from '../../../ui/mono/mono.component';
import { OverlayHostComponent } from '../../../ui/overlay-host/overlay-host.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { SheetComponent } from '../../../ui/sheet/sheet.component';
import { SkeletonComponent } from '../../../ui/skeleton/skeleton.component';
import { DataSourcesStore, type VersionAction } from './data-sources.store';
import { versionFacts } from './data-source.rows';

/** One version of a data source: its facts, its actions and its log. */
@Component({
  selector: 'app-version-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    ListRowComponent,
    MonoComponent,
    OverlayHostComponent,
    RowGroupComponent,
    SectionComponent,
    SheetComponent,
    SkeletonComponent,
    TranslatePipe,
  ],
  templateUrl: './version-sheet.component.html',
  styleUrl: './version-sheet.component.scss',
})
export class VersionSheetComponent {
  private readonly i18n = inject(I18nService);
  private readonly store = inject(DataSourcesStore);

  /** The id of the open version. The sheet reads the version from the store, so a poll updates it. */
  readonly versionId = input<string | null>(null);
  readonly closed = output();

  protected readonly asking = signal(false);

  private readonly text = (key: TranslationKey, values?: Record<string, string | number>): string =>
    this.i18n.translate(key, values);

  private readonly all = computed(() => this.store.detail()?.versions ?? []);

  protected readonly version = computed<DataSourceVersion | null>(
    () => this.all().find((one) => one.id === this.versionId()) ?? null,
  );

  protected readonly title = computed(() => {
    const version = this.version();
    return version === null ? '' : this.text('admin.dataSources.version', { nummer: version.version });
  });

  protected readonly facts = computed(() => {
    const version = this.version();
    return version === null ? [] : versionFacts(version, this.all(), this.text, this.i18n.locale());
  });

  protected readonly busy = computed(() => this.store.busy() === this.versionId());
  protected readonly canActivate = computed(
    () => ['ready', 'superseded'].includes(this.version()?.state ?? '') && this.version()?.active === false,
  );

  protected readonly log = computed(() => {
    const log = this.store.log();
    return log !== null && log.versionId === this.versionId() ? log : null;
  });
  protected readonly logText = computed(() => this.log()?.lines.join('\n') ?? '');
  protected readonly logOpen = signal(false);

  protected readonly deleteQuestion = computed(() => {
    const version = this.version();
    return version === null ? '' : this.text('admin.dataSources.deleteConfirm', { nummer: version.version });
  });

  protected act(action: VersionAction['action']): void {
    const version = this.version();
    if (version === null || this.busy()) return;
    this.asking.set(false);
    this.store.act({
      version,
      action,
      onDone: () => {
        if (action === 'remove') this.close();
      },
    });
  }

  protected toggleLog(): void {
    const open = !this.logOpen();
    this.logOpen.set(open);
    this.store.showLog(open ? this.version() : null);
  }

  protected close(): void {
    this.logOpen.set(false);
    this.store.showLog(null);
    this.closed.emit();
  }
}
