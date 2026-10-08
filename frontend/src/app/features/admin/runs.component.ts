import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PermissionsStore } from '../../core/access/permissions.store';
import type { PipelineRun, RunKind } from '../../core/api/models';
import { RUN_KINDS } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { ProgressComponent } from '../../ui/progress/progress.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { DataSourcesStore } from './data-sources/data-sources.store';
import { needText } from './data-sources/data-sources.rows';
import { RunsStore } from './runs.store';
import {
  RUN_KIND_TEXT,
  RUN_STATE_TEXT,
  activeSubline,
  runPercent,
  runSubline,
  runTitle,
  secondsBetween,
  shortDuration,
} from './runs.rows';

/** A row of the list of recent runs. */
interface Row {
  id: string;
  title: string;
  subline: string;
  duration: string;
  failed: boolean;
}

/** The running run as a card above the list. */
interface Active {
  id: string;
  title: string;
  subline: string;
  state: string;
  percent: number;
}

/** The runs: what the pipeline does now and what it did last. */
@Component({
  selector: 'app-runs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ConfirmDialogComponent,
    LevelPillComponent,
    ListRowComponent,
    PageHeaderComponent,
    ProgressComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SectionComponent,
    SegmentedComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './runs.component.html',
  styleUrl: './runs.component.scss',
})
export class RunsComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(RunsStore);
  private readonly sources = inject(DataSourcesStore);
  private readonly rights = inject(PermissionsStore);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly starting = signal(false);
  protected readonly kind = signal<RunKind>('training');
  protected readonly loaded = computed(() => this.store.runs() !== null);

  private readonly text = (key: TranslationKey, values?: Record<string, string | number>): string =>
    this.i18n.translate(key, values);

  protected readonly active = computed<Active | null>(() => {
    const run = (this.store.runs() ?? []).find((one) => one.state === 'running');
    if (run === undefined) return null;
    return {
      id: run.id,
      title: runTitle(run, this.text),
      subline: activeSubline(run, this.text, new Date().toISOString()),
      state: this.text(RUN_STATE_TEXT[run.state]),
      percent: runPercent(run),
    };
  });

  protected readonly rows = computed<Row[]>(() =>
    (this.store.runs() ?? [])
      .filter((run) => run.state !== 'running' && run.state !== 'queued')
      .map((run) => ({
        id: run.id,
        title: runTitle(run, this.text),
        subline: runSubline(run, this.text, this.i18n.locale()),
        duration: this.duration(run),
        failed: run.state === 'failed',
      })),
  );

  protected readonly choices = computed<SegmentOption[]>(() =>
    RUN_KINDS.map((kind) => ({ value: kind, label: this.text(RUN_KIND_TEXT[kind]) })),
  );

  /** The missing inputs of the chosen kind. Without `data.manage`, the server checks alone. */
  protected readonly missing = computed(() => {
    const blocked = this.sources.blocked().find((entry) => entry.run === this.kind());
    if (blocked === undefined) return '';
    return this.text('admin.runs.missing', {
      inputs: joined(blocked.missing.map((need) => needText(need, this.text))),
    });
  });

  constructor() {
    this.store.load();
    if (this.rights.can('data.manage')) this.sources.loadOverview();
  }

  protected chooseKind(value: string): void {
    this.kind.set(value as RunKind);
  }

  protected start(): void {
    if (this.missing() !== '') return;
    this.store.start({
      kind: this.kind(),
      onDone: () => {
        this.starting.set(false);
      },
    });
  }

  protected open(id: string): void {
    void this.router.navigate(['/verwaltung/laeufe', id]);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }

  /** A run without an end has no duration. */
  private duration(run: PipelineRun): string {
    const started = run.startedAt;
    const finished = run.finishedAt;
    if (started === null || started === undefined) return '';
    if (finished === null || finished === undefined) return '';
    return shortDuration(secondsBetween(started, finished), this.text);
  }
}
