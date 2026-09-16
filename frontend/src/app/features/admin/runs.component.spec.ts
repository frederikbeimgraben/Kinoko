import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ANY_ROUTE } from '../../testing/routes';
import { RunsComponent } from './runs.component';
import { RunsState } from './runs.state';

const RUNNING = {
  id: 'lauf-aktiv',
  kind: 'full',
  state: 'running',
  queuedAt: '2026-09-14T09:00:00+02:00',
  startedAt: '2026-09-14T09:04:00+02:00',
  finishedAt: null,
  triggeredById: null,
  speciesName: null,
  speciesCount: 11,
  recordCount: 0,
  progressDone: 3,
  progressTotal: 12,
};

const DONE = {
  ...RUNNING,
  id: 'lauf-training',
  kind: 'training',
  state: 'finished',
  startedAt: '2026-09-13T19:04:00+02:00',
  finishedAt: '2026-09-13T19:22:22+02:00',
  speciesName: 'Steinpilz',
  speciesCount: 1,
  recordCount: 1284,
};

async function build(items: unknown[] = [RUNNING, DONE]): Promise<{
  container: Element;
  http: HttpTestingController;
}> {
  TestBed.resetTestingModule();
  const { container } = await render(RunsComponent, {
    providers: [provideRouter(ANY_ROUTE), provideHttpClient(), provideHttpClientTesting()],
  });
  const http = TestBed.inject(HttpTestingController);
  http.expectOne('/api/pipeline-runs').flush({ items, nextCursor: null });
  return { container, http };
}

describe('RunsComponent', () => {
  beforeEach(() => {
    TestBed.inject(RunsState);
  });

  it('zeigt den laufenden Lauf über der Liste der letzten', async () => {
    const { container } = await build();

    expect(await screen.findByText('Vollständig')).toBeInTheDocument();
    expect(screen.getByText(/Woche 3 von 12/)).toBeInTheDocument();
    expect(screen.getByText('Training Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('18 min')).toBeInTheDocument();
    await noViolations(container);
  });

  it('lässt den laufenden Lauf aus der Liste der letzten weg', async () => {
    await build([RUNNING]);

    expect(await screen.findByText('Vollständig')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vollständig/ })).toBeInTheDocument();
    expect(screen.queryByText('1 h 52')).not.toBeInTheDocument();
  });

  it('stößt den gewählten Lauf an und stellt ihn nach vorn', async () => {
    const { http } = await build();
    await userEvent.click(await screen.findByRole('button', { name: 'Lauf anstoßen' }));

    await userEvent.click(screen.getByRole('tab', { name: 'Rendern' }));
    await userEvent.click(screen.getByRole('button', { name: 'Anstoßen' }));

    const call = http.expectOne('/api/pipeline-runs');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual({ kind: 'render' });
    call.flush({ ...RUNNING, id: 'lauf-neu', kind: 'render' });
  });

  it('bleibt ohne Lauf leer, ohne Karte und ohne Zeile', async () => {
    await build([]);

    expect(screen.getByRole('heading', { name: 'Läufe' })).toBeInTheDocument();
    expect(screen.queryByText('Vollständig')).not.toBeInTheDocument();
  });
});
