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

/** Translates a key with its values. */
export type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

export const RUN_KIND_TEXT: Readonly<Record<RunKind, TranslationKey>> = {
  training: 'enum.run_kind.training',
  render: 'enum.run_kind.render',
  full: 'enum.run_kind.full',
  fetch: 'enum.run_kind.fetch',
};

export const RUN_STATE_TEXT: Readonly<Record<RunState, TranslationKey>> = {
  queued: 'enum.run_state.queued',
  running: 'enum.run_state.running',
  finished: 'enum.run_state.finished',
  failed: 'enum.run_state.failed',
};

const MINUTE = 60;
const HOUR = 3600;

/** The name of a run. A training adds the name of its species. */
export function runTitle(run: PipelineRun, text: Translate): string {
  const kind = text(RUN_KIND_TEXT[run.kind]);
  return run.speciesName === null || run.speciesName === undefined ? kind : `${kind} ${run.speciesName}`;
}

/** The duration in the list: hours and minutes from one hour on, else only minutes. */
export function shortDuration(seconds: number, text: Translate): string {
  if (seconds >= HOUR) {
    const hours = Math.floor(seconds / HOUR);
    const rest = Math.floor((seconds % HOUR) / MINUTE);
    return `${hours} ${text('unit.hour')} ${String(rest).padStart(2, '0')}`;
  }
  return `${Math.floor(seconds / MINUTE)} ${text('unit.minute')}`;
}

/** The duration on the page of the run: minutes and seconds. */
export function longDuration(seconds: number, text: Translate): string {
  const parts: string[] = [];
  if (seconds >= HOUR) parts.push(`${Math.floor(seconds / HOUR)} ${text('unit.hour')}`);
  parts.push(`${Math.floor((seconds % HOUR) / MINUTE)} ${text('unit.minute')}`);
  parts.push(`${seconds % MINUTE} ${text('unit.second')}`);
  return parts.join(' ');
}

/** The seconds between two points in time. */
export function secondsBetween(from: string, to: string): number {
  return Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 1000));
}

/** The result of a run: rendered species, visits, fetched data or a failure. */
export function runResult(run: PipelineRun, text: Translate): string {
  if (run.state === 'failed') return text('enum.run_state.failed');
  if (run.kind === 'fetch') return text('admin.runs.fetched');
  if (run.kind === 'training') return text('admin.runs.visits', { zahl: grouped(run.recordCount) });
  return text('admin.runs.rendered', { zahl: grouped(run.speciesCount) });
}

/** The sub-line of a finished run: the weekday and the result. */
export function runSubline(run: PipelineRun, text: Translate, locale: string): string {
  const day = run.startedAt ?? run.queuedAt;
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(day));
  return joined([weekday, runResult(run, text)]);
}

/** The progress of a run in weeks. */
export function runProgress(run: PipelineRun, text: Translate): string {
  return text('admin.runs.week', { getan: run.progressDone, gesamt: run.progressTotal });
}

/** The sub-line of the running run: the progress and the time since the start. */
export function activeSubline(run: PipelineRun, text: Translate, now: string): string {
  const progress = runProgress(run, text);
  const started = run.startedAt;
  if (started === null || started === undefined) return progress;
  const minutes = Math.floor(secondsBetween(started, now) / MINUTE);
  return joined([progress, text('admin.runs.since', { zahl: minutes })]);
}

/** The share of a run in percent. Without a total, the bar stays empty. */
export function runPercent(run: PipelineRun): number {
  return run.progressTotal === 0 ? 0 : (100 * run.progressDone) / run.progressTotal;
}

/** The sub-line of a step: the progress while it runs, else the duration. */
export function stepSubline(step: PipelineRunStep, run: PipelineRun, text: Translate): string {
  if (step.state === 'running') return runProgress(run, text);
  return step.durationS === null ? '' : shortDuration(step.durationS, text);
}

/** The visits of a run, with the visits from the app. */
export function visitsValue(detail: PipelineRunDetail, text: Translate): string {
  const finds = detail.species.reduce((sum, one) => sum + one.findCount, 0);
  return text('admin.run.visitsValue', { zahl: grouped(detail.recordCount), app: grouped(finds) });
}

/** The result of a training: the Brier score and its comparison. */
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

/** The day and the time of the start of a run. */
export function startedValue(run: PipelineRun, i18n: I18nService): string {
  const date = new Date(run.startedAt ?? run.queuedAt);
  const day = shortDay(date, i18n);
  const time = new Intl.DateTimeFormat(i18n.locale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return i18n.translate('common.dateTime', { tag: day, zeit: time });
}
