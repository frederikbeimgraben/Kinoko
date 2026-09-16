import type { PipelineRun, PipelineRunDetail } from '../../core/api/models';
import {
  activeSubline,
  brierValue,
  longDuration,
  runPercent,
  runResult,
  runSubline,
  runTitle,
  secondsBetween,
  shortDuration,
  startedValue,
  stepSubline,
  visitsValue,
} from './runs.rows';

const TEXTS: Record<string, string> = {
  'enum.run_kind.training': 'Training',
  'enum.run_kind.render': 'Rendern',
  'enum.run_kind.full': 'Vollständig',
  'enum.run_state.failed': 'fehlgeschlagen',
  'unit.hour': 'h',
  'unit.minute': 'min',
  'unit.second': 's',
  'admin.runs.visits': '{zahl} Begehungen',
  'admin.runs.rendered': '{zahl} Arten gerendert',
  'admin.runs.week': 'Woche {getan} von {gesamt}',
  'admin.runs.since': 'seit {zahl} Minuten',
  'admin.run.visitsValue': '{zahl}, davon {app} aus der App',
  'admin.run.brier': 'Brier {wert}',
  'admin.run.better': 'besser',
  'admin.run.worse': 'schlechter',
  'common.dateShort': '{tag}. {monat}',
  'common.dateTime': '{tag}, {zeit}',
};

function text(key: string, values: Record<string, string | number> = {}): string {
  const shape = TEXTS[key] ?? key;
  return shape.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? ''));
}

const RUN: PipelineRun = {
  id: 'lauf-eins',
  kind: 'training',
  state: 'finished',
  queuedAt: '2026-09-13T19:00:00+02:00',
  startedAt: '2026-09-13T19:04:00+02:00',
  finishedAt: '2026-09-13T19:22:22+02:00',
  triggeredById: null,
  speciesName: 'Steinpilz',
  speciesCount: 1,
  recordCount: 1284,
  progressDone: 3,
  progressTotal: 12,
};

describe('runs.rows', () => {
  it('nennt ein Training mit seiner Art, einen Wochenlauf ohne', () => {
    expect(runTitle(RUN, text)).toBe('Training Steinpilz');
    expect(runTitle({ ...RUN, kind: 'full', speciesName: null }, text)).toBe('Vollständig');
  });

  it('schreibt die Dauer ab einer Stunde mit zweistelligen Minuten', () => {
    expect(shortDuration(6720, text)).toBe('1 h 52');
    expect(shortDuration(3660, text)).toBe('1 h 01');
    expect(shortDuration(1102, text)).toBe('18 min');
    expect(longDuration(1102, text)).toBe('18 min 22 s');
    expect(longDuration(6720, text)).toBe('1 h 52 min 0 s');
  });

  it('zählt die Sekunden zwischen zwei Zeitpunkten, nie unter null', () => {
    expect(secondsBetween('2026-09-13T19:00:00Z', '2026-09-13T19:22:00Z')).toBe(1320);
    expect(secondsBetween('2026-09-13T19:22:00Z', '2026-09-13T19:00:00Z')).toBe(0);
  });

  it('nennt als Ergebnis Begehungen, gerenderte Arten oder den Abbruch', () => {
    expect(runResult(RUN, text)).toBe('1 284 Begehungen');
    expect(runResult({ ...RUN, kind: 'render', speciesCount: 11 }, text)).toBe('11 Arten gerendert');
    expect(runResult({ ...RUN, state: 'failed' }, text)).toBe('fehlgeschlagen');
  });

  it('stellt Wochentag und Ergebnis in die Unterzeile', () => {
    expect(runSubline(RUN, text, 'de')).toBe('Sonntag · 1 284 Begehungen');
  });

  it('nennt im laufenden Lauf Woche und Laufzeit', () => {
    const run = { ...RUN, state: 'running' as const, finishedAt: null };
    expect(activeSubline(run, text, '2026-09-13T19:26:00+02:00')).toBe(
      'Woche 3 von 12 · seit 22 Minuten',
    );
    expect(activeSubline({ ...run, startedAt: null }, text, '2026-09-13T19:26:00+02:00')).toBe(
      'Woche 3 von 12',
    );
  });

  it('rechnet den Anteil, ohne Ziel bleibt er null', () => {
    expect(runPercent(RUN)).toBe(25);
    expect(runPercent({ ...RUN, progressTotal: 0 })).toBe(0);
  });

  it('zeigt am laufenden Schritt die Woche, sonst die Dauer', () => {
    expect(stepSubline({ position: 1, name: 'x', state: 'running', durationS: null }, RUN, text)).toBe(
      'Woche 3 von 12',
    );
    expect(stepSubline({ position: 1, name: 'x', state: 'finished', durationS: 120 }, RUN, text)).toBe(
      '2 min',
    );
    expect(stepSubline({ position: 1, name: 'x', state: 'queued', durationS: null }, RUN, text)).toBe('');
  });

  it('nennt die Begehungen und die aus der App', () => {
    const detail: PipelineRunDetail = {
      ...RUN,
      logPath: null,
      metricBrier: 0.0612,
      metricBrierPrevious: 0.0637,
      species: [
        { speciesId: 'a', state: 'finished', recordCount: 1000, findCount: 30 },
        { speciesId: 'b', state: 'finished', recordCount: 284, findCount: 12 },
      ],
      steps: [],
      logTail: [],
    };
    expect(visitsValue(detail, text)).toBe('1 284, davon 42 aus der App');
    expect(brierValue(detail, text, 'de')).toBe('Brier 0,061 · besser');
    expect(brierValue({ ...detail, metricBrierPrevious: 0.06 }, text, 'de')).toBe('Brier 0,061 · schlechter');
    expect(brierValue({ ...detail, metricBrierPrevious: null }, text, 'de')).toBe('Brier 0,061');
    expect(brierValue({ ...detail, metricBrier: null }, text, 'de')).toBe('');
  });

  it('schreibt Tag und Uhrzeit des Beginns', () => {
    const month = new Intl.DateTimeFormat('de', { month: 'short' }).format(new Date(RUN.startedAt ?? ''));
    expect(startedValue(RUN, text, 'de')).toBe(`13. ${month}, 19:04`);
  });
});
