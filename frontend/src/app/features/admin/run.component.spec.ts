import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { of } from 'rxjs';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { RunComponent } from './run.component';
import { RunState } from './run.state';

const DETAIL = {
  id: 'lauf-training',
  kind: 'training',
  state: 'running',
  queuedAt: '2026-09-13T19:00:00+02:00',
  startedAt: '2026-09-13T19:04:00+02:00',
  finishedAt: '2026-09-13T19:22:22+02:00',
  triggeredById: null,
  speciesName: 'Steinpilz',
  speciesCount: 1,
  recordCount: 1284,
  progressDone: 3,
  progressTotal: 12,
  logPath: null,
  metricBrier: 0.0612,
  metricBrierPrevious: 0.0637,
  species: [{ speciesId: 'art-eins', state: 'finished', recordCount: 1284, findCount: 42 }],
  steps: [
    { position: 1, name: 'Daten holen', state: 'finished', durationS: 120 },
    { position: 2, name: 'Karten rendern', state: 'running', durationS: null },
  ],
  logTail: ['chosen 40 features, gain 0.0061'],
};

function routeFor(id: string): { provide: typeof ActivatedRoute; useValue: unknown } {
  const params = convertToParamMap({ id });
  return { provide: ActivatedRoute, useValue: { paramMap: of(params), snapshot: { paramMap: params } } };
}

async function build(detail: Record<string, unknown> = DETAIL): Promise<Element> {
  TestBed.resetTestingModule();
  const { container } = await render(RunComponent, {
    providers: [
      provideRouter(ANY_ROUTE),
      provideHttpClient(),
      provideHttpClientTesting(),
      routeFor('lauf-training'),
    ],
  });
  TestBed.inject(HttpTestingController).expectOne('/api/pipeline-runs/lauf-training').flush(detail);
  return container;
}

describe('RunComponent', () => {
  beforeEach(() => {
    TestBed.inject(RunState).load('');
  });

  it('nennt Kopf, Zahlen, Schritte und Ausgabe', async () => {
    const container = await build();

    expect(await screen.findByRole('heading', { name: 'Training Steinpilz' })).toBeInTheDocument();
    expect(screen.getByText('18 min 22 s')).toBeInTheDocument();
    expect(screen.getByText('1 284, davon 42 aus der App')).toBeInTheDocument();
    expect(screen.getByText('Brier 0,061 · besser')).toBeInTheDocument();
    expect(screen.getByText('Karten rendern')).toBeInTheDocument();
    expect(screen.getByText('Woche 3 von 12')).toBeInTheDocument();
    expect(screen.getByText(/chosen 40 features/)).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt Ergebnis und Ausgabe weg, wenn der Lauf keine trägt', async () => {
    await build({ ...DETAIL, metricBrier: null, logTail: [], steps: [] });

    expect(await screen.findByRole('heading', { name: 'Training Steinpilz' })).toBeInTheDocument();
    expect(screen.queryByText(/Brier/)).not.toBeInTheDocument();
    expect(screen.queryByText('Schritte')).not.toBeInTheDocument();
  });
});
