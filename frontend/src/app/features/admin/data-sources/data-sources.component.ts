import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { DataSourceKind, RemoteSourceId } from '../../../core/api/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../../core/i18n/translations';
import { ViewportService } from '../../../core/layout/viewport.service';
import { BannerComponent } from '../../../ui/banner/banner.component';
import { IconButtonComponent } from '../../../ui/icon-button/icon-button.component';
import { LevelPillComponent } from '../../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { RowGroupSkeletonComponent } from '../../../ui/skeleton/row-group-skeleton.component';
import { RUN_KIND_TEXT } from '../runs.rows';
import { NeedsSheetComponent } from './needs-sheet.component';
import { RemoteSheetComponent } from './remote-sheet.component';
import { UploadSheetComponent } from './upload-sheet.component';
import { DataSourcesStore } from './data-sources.store';
import { remoteRow, uploadRow, type RemoteRow, type UploadRow } from './data-sources.rows';

/** A banner line for a run kind with unmet inputs. */
interface BlockedLine {
  readonly run: string;
  readonly text: string;
  readonly count: number;
}

/** The data sources: the remote caches and the uploaded kinds, with the run preconditions on top. */
@Component({
  selector: 'app-data-sources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BannerComponent,
    IconButtonComponent,
    LevelPillComponent,
    ListRowComponent,
    NeedsSheetComponent,
    PageHeaderComponent,
    RemoteSheetComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SectionComponent,
    TranslatePipe,
    UploadSheetComponent,
  ],
  templateUrl: './data-sources.component.html',
  styleUrl: './data-sources.component.scss',
})
export class DataSourcesComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(DataSourcesStore);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly loaded = this.store.loaded;
  protected readonly remote = signal<RemoteSourceId | null>(null);
  protected readonly uploading = signal<DataSourceKind | null>(null);
  protected readonly needsOpen = signal(false);

  private readonly text = (key: TranslationKey, values?: Record<string, string | number>): string =>
    this.i18n.translate(key, values);

  protected readonly remotes = computed<readonly RemoteRow[]>(() =>
    (this.store.remotes() ?? []).map((one) => remoteRow(one, this.text, this.i18n.locale())),
  );

  protected readonly uploads = computed<readonly UploadRow[]>(() =>
    (this.store.sources() ?? []).map((one) => uploadRow(one, this.text, this.i18n.locale())),
  );

  protected readonly blocked = computed<readonly BlockedLine[]>(() =>
    this.store.blocked().map((entry) => {
      const run = this.text(RUN_KIND_TEXT[entry.run]);
      return {
        run: entry.run,
        text: this.text('admin.dataSources.blocked', { lauf: run }),
        count: entry.missing.length,
      };
    }),
  );

  protected readonly uploadLabel = computed(() => this.text('admin.dataSources.upload'));

  constructor() {
    this.store.loadOverview();
  }

  protected open(kind: DataSourceKind): void {
    void this.router.navigate(['/verwaltung/datenquellen', kind]);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }
}
