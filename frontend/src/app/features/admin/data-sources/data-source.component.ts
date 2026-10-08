import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DATA_SOURCE_KINDS, type DataSourceKind } from '../../../core/api/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../../core/i18n/translations';
import { injectRouteParam } from '../../../core/navigation/route-param';
import { BannerComponent } from '../../../ui/banner/banner.component';
import { IconButtonComponent } from '../../../ui/icon-button/icon-button.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import {
  OptionSheetComponent,
  type OptionSheetOption,
} from '../../../ui/option-sheet/option-sheet.component';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { RowGroupSkeletonComponent } from '../../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../../ui/state-view/state-view.component';
import { SpeciesState } from '../../species/species.state';
import { DataSourcesStore } from './data-sources.store';
import { versionRow } from './data-sources.rows';
import { formatFacts, metaFacts, speciesRows } from './data-source.rows';
import { bytesText } from './format';
import { KIND_DESCRIPTION, KIND_TEXT, STATE_TEXT, STATE_TONE } from './labels';
import { UploadSheetComponent } from './upload-sheet.component';
import { UploadStore } from './upload.store';
import { VersionSheetComponent } from './version-sheet.component';

/** The option of the species filter that shows each species. */
const ALL = '';

/** The page of one data source: its format, its active version, its history and its artifacts. */
@Component({
  selector: 'app-data-source',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BannerComponent,
    IconButtonComponent,
    ListRowComponent,
    OptionSheetComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SectionComponent,
    StateViewComponent,
    TranslatePipe,
    UploadSheetComponent,
    VersionSheetComponent,
  ],
  templateUrl: './data-source.component.html',
  styleUrl: './data-source.component.scss',
})
export class DataSourceComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(DataSourcesStore);
  private readonly uploads = inject(UploadStore);
  private readonly species = inject(SpeciesState);

  private readonly param = injectRouteParam('kind');
  protected readonly kind = computed<DataSourceKind | null>(() => {
    const kind = this.param() as DataSourceKind;
    return DATA_SOURCE_KINDS.includes(kind) ? kind : null;
  });

  protected readonly uploading = signal<DataSourceKind | null>(null);
  protected readonly openVersion = signal<string | null>(null);
  protected readonly picking = signal(false);

  private readonly text = (key: TranslationKey, values?: Record<string, string | number>): string =>
    this.i18n.translate(key, values);

  /** The detail of the route kind. The store can still hold the detail of the page before. */
  protected readonly detail = computed(() => {
    const detail = this.store.detail();
    return detail !== null && detail.kind === this.kind() ? detail : null;
  });

  protected readonly title = computed(() => {
    const kind = this.kind();
    return kind === null ? this.text('admin.dataSources.title') : this.text(KIND_TEXT[kind]);
  });

  protected readonly about = computed(() => {
    const kind = this.kind();
    return kind === null ? '' : this.text(KIND_DESCRIPTION[kind]);
  });

  protected readonly state = computed(() => {
    const detail = this.detail();
    return detail === null
      ? null
      : { text: this.text(STATE_TEXT[detail.state]), tone: STATE_TONE[detail.state] };
  });

  protected readonly format = computed(() => {
    const detail = this.detail();
    return detail === null ? [] : formatFacts(detail, this.text, this.i18n.locale());
  });

  protected readonly active = computed(() => this.detail()?.activeVersion ?? null);

  protected readonly meta = computed(() => {
    const active = this.active();
    return active === null ? [] : metaFacts(active, this.text, this.i18n.locale());
  });

  protected readonly artifacts = computed(() =>
    (this.active()?.artifacts ?? []).map((one) => ({
      name: one.name,
      size: bytesText(one.sizeBytes, this.i18n.locale()),
    })),
  );

  protected readonly versions = computed(() =>
    (this.detail()?.versions ?? []).map((one) => versionRow(one, this.text, this.i18n.locale())),
  );

  protected readonly more = computed(() => (this.detail()?.nextCursor ?? null) !== null);

  /** The interrupted upload of this kind, when this browser does not run it. */
  protected readonly interrupted = computed(() => {
    const open = this.detail()?.openUpload ?? null;
    if (open === null || this.uploads.active()) return '';
    return this.text('admin.dataSources.openUpload', { name: open.fileName });
  });

  protected readonly perSpecies = computed(() => this.detail()?.perSpecies === true);
  protected readonly speciesId = this.store.speciesId;

  private readonly nameOf = (id: string): string =>
    this.species.species().find((one) => one.id === id)?.name ?? id;

  protected readonly speciesName = computed(() => {
    const id = this.speciesId();
    return id === null ? this.text('admin.dataSources.allSpecies') : this.nameOf(id);
  });

  protected readonly perSpeciesRows = computed(() =>
    this.speciesId() === null
      ? speciesRows(this.detail()?.versions ?? [], this.nameOf, this.text, this.i18n.locale())
      : [],
  );

  protected readonly speciesOptions = computed<OptionSheetOption[]>(() => [
    { id: ALL, title: this.text('admin.dataSources.allSpecies') },
    ...this.species.species().map((one) => ({ id: one.id, title: one.name })),
  ]);

  protected readonly uploadLabel = computed(() => this.text('admin.dataSources.upload'));

  constructor() {
    this.store.openDetail(
      computed(() => {
        const kind = this.kind();
        return kind === null ? null : { kind, speciesId: null };
      }),
    );
    void this.species.loadBundle();
  }

  protected chooseSpecies(id: string): void {
    const kind = this.kind();
    this.picking.set(false);
    if (kind !== null) this.store.openDetail({ kind, speciesId: id === ALL ? null : id });
  }

  protected upload(): void {
    this.uploading.set(this.kind());
  }

  protected loadMore(): void {
    this.store.more();
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung/datenquellen');
  }
}
