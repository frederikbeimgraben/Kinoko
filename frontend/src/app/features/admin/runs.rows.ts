import { shortDay } from '../../core/i18n/dates';
import type { I18nService } from '../../core/i18n/i18n.service';
import { grouped, joined } from '../../core/i18n/numbers';
import type { TranslationKey } from '../../core/i18n/translations';
import type {
  PipelineRun,
  PipelineRunDetail,
  PipelineRunStep,
  RunKind,
  RunState,
} from '../../core/api/models';

/** Übersetzt einen Schlüssel mit Platzhaltern. */
export type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

export const RUN_KIND_TEXT: Readonly<Record<RunKind, TranslationKey>> = {
  training: 'enum.run_kind.training',
  render: 'enum.run_kind.render',
  full: 'enum.run_kind.full',
};

export const RUN_STATE_TEXT: Readonly<Record<RunState, TranslationKey>> = {
  queued: 'enum.run_state.queued',
  running: 'enum.run_state.running',
  finished: 'enum.run_state.finished',
  failed: 'enum.run_state.failed',
};

const MINUTE = 60;
const HOUR = 3600;

/** Der Name eines Laufs. Ein Training nennt seine Art dazu. */
export function runTitle(run: PipelineRun, text: Translate): string {
  const kind = text(RUN_KIND_TEXT[run.kind]);
  return run.speciesName === null || run.speciesName === undefined ? kind : `${kind} ${run.speciesName}`;
}

/** Die Dauer in der Liste: ab einer Stunde mit Minuten, sonst nur Minuten. */
export function shortDuration(seconds: number, text: Translate): string {
  if (seconds >= HOUR) {
    const hours = Math.floor(seconds / HOUR);
    const rest = Math.floor((seconds % HOUR) / MINUTE);
    return `${hours} ${text('unit.hour')} ${String(rest).padStart(2, '0')}`;
  }
  return `${Math.floor(seconds / MINUTE)} ${text('unit.minute')}`;
}

/** Die Dauer auf der Seite des Laufs: Minuten und Sekunden. */
export function longDuration(seconds: number, text: Translate): string {
  const parts: string[] = [];
  if (seconds >= HOUR) parts.push(`${Math.floor(seconds / HOUR)} ${text('unit.hour')}`);
  parts.push(`${Math.floor((seconds % HOUR) / MINUTE)} ${text('unit.minute')}`);
  parts.push(`${seconds % MINUTE} ${text('unit.second')}`);
  return parts.join(' ');
}

/** Die Sekunden zwischen zwei Zeitpunkten. */
export function secondsBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));
}

/** Was ein Lauf gebracht hat: gerenderte Arten, Begehungen oder ein Abbruch. */
export function runResult(run: PipelineRun, text: Translate): string {
  if (run.state === 'failed') return text('enum.run_state.failed');
  if (run.kind === 'training') return text('admin.runs.visits', { zahl: grouped(run.recordCount) });
  return text('admin.runs.rendered', { zahl: grouped(run.speciesCount) });
}

/** Die Unterzeile eines fertigen Laufs: Wochentag und Ergebnis. */
export function runSubline(run: PipelineRun, text: Translate, locale: string): string {
  const day = run.startedAt ?? run.queuedAt;
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(day));
  return joined([weekday, runResult(run, text)]);
}

/** Der Fortschritt eines Laufs in Wochen. */
export function runProgress(run: PipelineRun, text: Translate): string {
  return text('admin.runs.week', { getan: run.progressDone, gesamt: run.progressTotal });
}

/** Die Unterzeile des laufenden Laufs: Fortschritt und Laufzeit. */
export function activeSubline(run: PipelineRun, text: Translate, now: string): string {
  const progress = runProgress(run, text);
  const started = run.startedAt;
  if (started === null || started === undefined) return progress;
  const minutes = Math.floor(secondsBetween(started, now) / MINUTE);
  return joined([progress, text('admin.runs.since', { zahl: minutes })]);
}

/** Der Anteil eines Laufs in Prozent. Ohne Ziel bleibt der Balken leer. */
export function runPercent(run: PipelineRun): number {
  return run.progressTotal === 0 ? 0 : (100 * run.progressDone) / run.progressTotal;
}

/** Die Unterzeile eines Schritts: Fortschritt, solange er läuft, sonst Dauer. */
export function stepSubline(step: PipelineRunStep, run: PipelineRun, text: Translate): string {
  if (step.state === 'running') return runProgress(run, text);
  return step.durationS === null ? '' : shortDuration(step.durationS, text);
}

/** Die Begehungen eines Laufs, dazu die aus der App. */
export function visitsValue(detail: PipelineRunDetail, text: Translate): string {
  const finds = detail.species.reduce((sum, one) => sum + one.findCount, 0);
  return text('admin.run.visitsValue', { zahl: grouped(detail.recordCount), app: grouped(finds) });
}

/** Das Ergebnis eines Trainings: der Brier-Wert und sein Vergleich. */
export function brierValue(detail: PipelineRunDetail, text: Translate, locale: string): string {
  const score = detail.metricBrier;
  if (score === null || score === undefined) return '';
  const value = new Intl.NumberFormat(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(
    score,
  );
  const before = detail.metricBrierPrevious;
  const brier = text('admin.run.brier', { wert: value });
  if (before === null || before === undefined) return brier;
  return joined([brier, text(score < before ? 'admin.run.better' : 'admin.run.worse')]);
}

/** Der Tag und die Uhrzeit, zu der ein Lauf begonnen hat. */
export function startedValue(run: PipelineRun, i18n: I18nService): string {
  const date = new Date(run.startedAt ?? run.queuedAt);
  const day = shortDay(date, i18n);
  const time = new Intl.DateTimeFormat(i18n.locale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return i18n.translate('common.dateTime', { tag: day, zeit: time });
}
