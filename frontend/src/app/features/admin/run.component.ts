import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { BadgeComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { RunState } from './run.state';
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

/** Eine Zeile der Kopfkarte: Beschriftung und Wert. */
interface Fact {
  key: string;
  title: string;
  value: string;
}

/** Ein Schritt des Laufs mit seinem Zustand. */
interface Step {
  key: number;
  title: string;
  subline: string;
  done: boolean;
  state: string;
}

/** Ein Lauf: seine Zahlen, seine Schritte und seine Ausgabe. */
@Component({
  selector: 'app-run',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ListRowComponent, PageHeaderComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './run.component.html',
  styleUrl: './run.component.scss',
})
export class RunComponent {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(RunState);

  private readonly id = toSignal(this.route.paramMap.pipe(map((one) => one.get('id') ?? '')), {
    initialValue: this.route.snapshot.paramMap.get('id') ?? '',
  });

  private readonly text = (key: TranslationKey, values?: Record<string, string | number>): string =>
    this.i18n.translate(key, values);

  protected readonly run = this.state.run;

  protected readonly title = computed(() => {
    const run = this.run();
    return run === null ? this.i18n.translate('admin.run.notFound') : runTitle(run, this.text);
  });

  protected readonly facts = computed<Fact[]>(() => {
    const run = this.run();
    if (run === null) return [];
    return [
      {
        key: 'started',
        title: this.text('admin.run.startedAt'),
        value: startedValue(run, this.i18n),
      },
      { key: 'duration', title: this.text('admin.run.duration'), value: this.duration() },
      { key: 'visits', title: this.text('admin.run.visits'), value: visitsValue(run, this.text) },
    ].filter((fact) => fact.value !== '');
  });

  protected readonly result = computed(() => {
    const run = this.run();
    return run === null ? '' : brierValue(run, this.text, this.i18n.locale());
  });

  protected readonly resultTitle = computed(() => this.text('admin.run.result'));

  protected readonly steps = computed<Step[]>(() => {
    const run = this.run();
    if (run === null) return [];
    return run.steps.map((step) => ({
      key: step.position,
      title: step.name,
      subline: stepSubline(step, run, this.text),
      done: step.state === 'finished',
      state: this.text(RUN_STATE_TEXT[step.state]),
    }));
  });

  protected readonly log = computed(() => this.run()?.logTail ?? []);

  constructor() {
    effect(() => {
      const id = this.id();
      if (id !== '') this.state.load(id);
    });
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung/laeufe');
  }

  /** Ein Lauf ohne Ende trägt keine Dauer. */
  private duration(): string {
    const run = this.run();
    const started = run?.startedAt;
    const finished = run?.finishedAt;
    if (started === null || started === undefined) return '';
    if (finished === null || finished === undefined) return '';
    return longDuration(secondsBetween(started, finished), this.text);
  }
}
