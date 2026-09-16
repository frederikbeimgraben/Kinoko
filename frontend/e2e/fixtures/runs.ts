/** Die Attrappen der Läufe für die Bretter `Runs`, `RunStart` und `Run`. */

/** Ein Lauf, so wie `/api/pipeline-runs` ihn liefert. */
export function run(
  id: string,
  kind: 'training' | 'render' | 'full',
  state: 'queued' | 'running' | 'finished' | 'failed',
  startedAt: string | null,
  finishedAt: string | null,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    kind,
    state,
    queuedAt: startedAt ?? '2026-09-14T03:30:00+02:00',
    startedAt,
    finishedAt,
    triggeredById: null,
    speciesName: null,
    speciesCount: 11,
    recordCount: 0,
    progressDone: 0,
    progressTotal: 12,
    ...extra,
  };
}

/** Die fünf Läufe des Bretts `Runs`: einer läuft, vier sind fertig. */
export const RUNS = {
  items: [
    run('lauf-aktiv', 'full', 'running', '2026-09-14T09:04:00+02:00', null, { progressDone: 3 }),
    run('lauf-woche', 'full', 'finished', '2026-09-14T03:30:00+02:00', '2026-09-14T05:22:00+02:00'),
    run('lauf-training', 'training', 'finished', '2026-09-13T19:04:00+02:00', '2026-09-13T19:22:22+02:00', {
      speciesName: 'Steinpilz',
      speciesCount: 1,
      recordCount: 1284,
    }),
    run('lauf-rendern', 'render', 'finished', '2026-09-14T06:00:00+02:00', '2026-09-14T06:24:00+02:00'),
    run('lauf-fehler', 'training', 'failed', '2026-09-12T08:00:00+02:00', '2026-09-12T08:02:00+02:00', {
      speciesName: 'Pfifferling',
      speciesCount: 1,
      recordCount: 12,
    }),
  ],
  nextCursor: null,
};

/** Die Uhrzeit, zu der die Bretter laufen: 22 Minuten nach dem Start. */
export const NOW = '2026-09-14T09:26:00+02:00';

/** Der Lauf des Bretts `Run`: vier Schritte fertig, einer läuft. */
export const RUN_DETAIL = {
  ...run('lauf-training', 'training', 'running', '2026-09-13T19:04:00+02:00', '2026-09-13T19:22:22+02:00', {
    speciesName: 'Steinpilz',
    speciesCount: 1,
    recordCount: 1284,
    progressDone: 3,
  }),
  logPath: 'reports/runs/lauf-training.log',
  metricBrier: 0.0612,
  metricBrierPrevious: 0.0637,
  species: [{ speciesId: 'art-eins', state: 'finished', recordCount: 1284, findCount: 42 }],
  steps: [
    { position: 1, name: 'Daten holen', state: 'finished', durationS: 120 },
    { position: 2, name: 'Begehungen bauen', state: 'finished', durationS: 240 },
    { position: 3, name: 'Modell rechnen', state: 'finished', durationS: 540 },
    { position: 4, name: 'Kalibrieren', state: 'finished', durationS: 60 },
    { position: 5, name: 'Karten rendern', state: 'running', durationS: null },
  ],
  logTail: [
    'chosen 40 features, gain 0.0061',
    'calibration ceiling 0.50',
    'Brier 0.0612 (vorher 0.0637)',
    'wrote reports/maps/boletus_edulis.json',
  ],
};
