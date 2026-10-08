import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DATA_SOURCE_KINDS, type DataSourceKind } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { type BadgeKind, LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { MonoComponent } from '../../ui/mono/mono.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { KIND_TEXT } from './data-sources/labels';
import { RunStore } from './run.store';
import {
  RUN_STATE_TEXT,
  brierValue,
  longDuration,
  runTitle,
  secondsBetween,
  startedValue,
  stepSubline,
  visitsValue,
} from './runs.rows';

/** A row of the head card: a label and a value. */
interface Fact {
  key: string;
  title: string;
  value: string;
}

/** A step of the run with its state. */
interface Step {
  key: number;
  title: string;
  subline: string;
  done: boolean;
  state: string;
  kind: BadgeKind;
}

/** An input of the run: the data source and its version. */
interface InputRow {
  key: string;
  title: string;
  version: string;
  /** A known kind opens the page of its data source. */
  kind: DataSourceKind | null;
}

/** One run: its counts, its inputs, its steps and its output. */
@Component({
  selector: 'app-run',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LevelPillComponent,
    ListRowComponent,
    MonoComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SectionComponent,
    StateViewComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './run.component.html',
  styleUrl: './run.component.scss',
})
export class RunComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(RunStore);

  private readonly id = injectRouteParam('id');

  private readonly text = (key: TranslationKey, values?: Record<string, string | number>): string =>
    this.i18n.translate(key, values);

  protected readonly run = this.store.run;
  protected readonly missing = this.store.failed;

  protected readonly title = computed(() => {
    const run = this.run();
    if (run !== null) return runTitle(run, this.text);
    return this.missing() ? this.text('admin.run.notFound') : '';
  });

  protected readonly facts = computed<Fact[]>(() => {
    const run = this.run();
    if (run === null) return [];
    return [
      { key: 'started', title: this.text('admin.run.startedAt'), value: startedValue(run, this.i18n) },
      { key: 'duration', title: this.text('admin.run.duration'), value: this.duration() },
      { key: 'visits', title: this.text('admin.run.visits'), value: visitsValue(run, this.text) },
    ].filter((fact) => fact.value !== '');
  });

  protected readonly result = computed(() => {
    const run = this.run();
    return run === null ? '' : brierValue(run, this.text, this.i18n.locale());
  });

  protected readonly resultTitle = computed(() => this.text('admin.run.result'));

  protected readonly inputs = computed<InputRow[]>(() =>
    (this.run()?.inputs ?? []).map((input) => {
      const kind = DATA_SOURCE_KINDS.includes(input.kind as DataSourceKind)
        ? (input.kind as DataSourceKind)
        : null;
      return {
        key: input.kind,
        title: kind === null ? input.kind : this.text(KIND_TEXT[kind]),
        version:
          input.version === null ? '' : this.text('admin.dataSources.version', { nummer: input.version }),
        kind,
      };
    }),
  );

  protected readonly steps = computed<Step[]>(() => {
    const run = this.run();
    if (run === null) return [];
    return run.steps.map((step) => ({
      key: step.position,
      title: step.name,
      subline: stepSubline(step, run, this.text),
      done: step.state === 'finished',
      state: this.text(RUN_STATE_TEXT[step.state]),
      kind: step.state === 'failed' ? 'bad' : '',
    }));
  });

  protected readonly log = computed(() => this.run()?.logTail ?? []);
  protected readonly logText = computed(() => this.log().join('\n'));

  constructor() {
    this.store.load(this.id);
  }

  protected openInput(kind: DataSourceKind | null): void {
    if (kind !== null) void this.router.navigate(['/verwaltung/datenquellen', kind]);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung/laeufe');
  }

  /** A run without an end has no duration. */
  private duration(): string {
    const run = this.run();
    const started = run?.startedAt;
    const finished = run?.finishedAt;
    if (started === null || started === undefined) return '';
    if (finished === null || finished === undefined) return '';
    return longDuration(secondsBetween(started, finished), this.text);
  }
}
