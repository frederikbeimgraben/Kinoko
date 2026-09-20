import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { PipelineRun, RunKind } from '../../core/api/models';
import { RUN_KINDS } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { ProgressComponent } from '../../ui/progress/progress.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { RunsState } from './runs.state';
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

/** Eine Zeile der Liste der letzten Läufe. */
interface Row {
  id: string;
  title: string;
  subline: string;
  duration: string;
  failed: boolean;
}

/** Der laufende Lauf als Karte über der Liste. */
interface Active {
  id: string;
  title: string;
  subline: string;
  state: string;
  percent: number;
}

/** Die Läufe: was die Kette gerade tut und was sie zuletzt getan hat. */
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
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './runs.component.html',
  styleUrl: './runs.component.scss',
})
export class RunsComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(RunsState);

  protected readonly starting = signal(false);
  protected readonly kind = signal<RunKind>('training');

  private readonly text = (key: TranslationKey, values?: Record<string, string | number>): string =>
    this.i18n.translate(key, values);

  protected readonly active = computed<Active | null>(() => {
    const run = (this.state.runs() ?? []).find((one) => one.state === 'running');
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
    (this.state.runs() ?? [])
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

  constructor() {
    this.state.load();
  }

  protected chooseKind(value: string): void {
    this.kind.set(value as RunKind);
  }

  protected start(): void {
    this.starting.set(false);
    this.state.start(this.kind());
  }

  protected open(id: string): void {
    void this.router.navigate(['/verwaltung/laeufe', id]);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }

  /** Ein Lauf ohne Ende trägt keine Dauer. */
  private duration(run: PipelineRun): string {
    const started = run.startedAt;
    const finished = run.finishedAt;
    if (started === null || started === undefined) return '';
    if (finished === null || finished === undefined) return '';
    return shortDuration(secondsBetween(started, finished), this.text);
  }
}
