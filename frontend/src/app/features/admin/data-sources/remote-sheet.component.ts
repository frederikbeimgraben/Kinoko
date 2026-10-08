import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { Router } from '@angular/router';
import type { RefreshRange, RemoteSource, RemoteSourceId } from '../../../core/api/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../../core/i18n/translations';
import { ActionBarComponent } from '../../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { OverlayHostComponent } from '../../../ui/overlay-host/overlay-host.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { SheetComponent } from '../../../ui/sheet/sheet.component';
import { DataSourcesStore } from './data-sources.store';
import { bytesText, momentText } from './format';
import { REMOTE_STATE_TEXT, REMOTE_TEXT } from './labels';

/** A label and a value of the remote source. */
interface Fact {
  readonly key: string;
  readonly title: string;
  readonly value: string;
}

/** A year from a field. An empty or wrong field gives no year. */
function yearOf(value: string): number | undefined {
  const year = Number(value.trim());
  return value.trim() !== '' && Number.isInteger(year) && year > 1900 ? year : undefined;
}

/** The drawer of a remote source: its cache, its schedule and a refresh with an optional range of years. */
@Component({
  selector: 'app-remote-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    ListRowComponent,
    OverlayHostComponent,
    RowGroupComponent,
    SectionComponent,
    SheetComponent,
    TranslatePipe,
  ],
  templateUrl: './remote-sheet.component.html',
  styleUrl: './remote-sheet.component.scss',
})
export class RemoteSheetComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(DataSourcesStore);

  readonly source = input<RemoteSourceId | null>(null);
  readonly closed = output();

  protected readonly fromYear = linkedSignal({ source: this.source, computation: () => '' });
  protected readonly toYear = linkedSignal({ source: this.source, computation: () => '' });

  private readonly text = (key: TranslationKey, values?: Record<string, string | number>): string =>
    this.i18n.translate(key, values);

  protected readonly remote = computed<RemoteSource | null>(
    () => this.store.remotes()?.find((one) => one.source === this.source()) ?? null,
  );

  protected readonly title = computed(() => {
    const source = this.source();
    return source === null ? '' : this.text(REMOTE_TEXT[source]);
  });

  protected readonly busy = computed(() => this.store.busy() === this.source());

  protected readonly fetchRun = computed(() => {
    const source = this.source();
    return source === null ? null : (this.store.fetchRuns()[source] ?? null);
  });

  protected readonly facts = computed<readonly Fact[]>(() => {
    const remote = this.remote();
    if (remote === null) return [];
    const locale = this.i18n.locale();
    const years =
      remote.years.length === 0 ? '' : `${Math.min(...remote.years)}–${Math.max(...remote.years)}`;
    return [
      {
        key: 'state',
        title: this.text('admin.dataSources.remote.state'),
        value: this.text(REMOTE_STATE_TEXT[remote.state]),
      },
      { key: 'url', title: this.text('admin.dataSources.remote.url'), value: remote.url },
      { key: 'cadence', title: this.text('admin.dataSources.remote.cadence'), value: remote.cadence },
      { key: 'years', title: this.text('admin.dataSources.remote.years'), value: years },
      { key: 'files', title: this.text('admin.dataSources.remote.files'), value: String(remote.files) },
      {
        key: 'size',
        title: this.text('admin.dataSources.remote.size'),
        value: bytesText(remote.sizeBytes, locale),
      },
      {
        key: 'checked',
        title: this.text('admin.dataSources.remote.checked'),
        value: momentText(remote.lastCheckedAt, locale),
      },
      {
        key: 'changed',
        title: this.text('admin.dataSources.remote.changed'),
        value: momentText(remote.lastChangedAt, locale),
      },
      { key: 'error', title: this.text('admin.dataSources.remote.error'), value: remote.error ?? '' },
    ].filter((fact) => fact.value !== '');
  });

  protected refresh(): void {
    const source = this.source();
    if (source === null) return;
    const range: RefreshRange = { fromYear: yearOf(this.fromYear()), toYear: yearOf(this.toYear()) };
    this.store.refresh({ source, range });
  }

  protected openRun(id: string): void {
    this.closed.emit();
    void this.router.navigate(['/verwaltung/laeufe', id]);
  }
}
