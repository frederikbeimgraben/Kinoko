import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { Observable } from 'rxjs';
import { DataSourcesApi } from '../../../core/api/data-sources.api';
import type { PipelineRun, RefreshRange, RemoteSourceId } from '../../../core/api/models';
import { noViolations } from '../../../testing/axe';
import { ANY_ROUTE } from '../../../testing/routes';
import { DataSourcesStore } from './data-sources.store';
import { DataSourcesApiDouble, remoteOf } from './data-sources.testing';
import { RemoteSheetComponent } from './remote-sheet.component';

/** The double records the range of each refresh. */
class RemoteApiDouble extends DataSourcesApiDouble {
  readonly ranges: RefreshRange[] = [];

  override refresh(source: RemoteSourceId, range: RefreshRange = {}): Observable<PipelineRun> {
    this.ranges.push(range);
    return super.refresh(source);
  }
}

async function build(source: RemoteSourceId | null, api = new RemoteApiDouble()) {
  const closed = vi.fn();
  const view = await render(RemoteSheetComponent, {
    inputs: { source },
    on: { closed },
    providers: [provideRouter(ANY_ROUTE), { provide: DataSourcesApi, useValue: api }],
  });
  TestBed.inject(DataSourcesStore).loadOverview();
  view.detectChanges();
  return { api, closed, view };
}

describe('RemoteSheetComponent', () => {
  it('shows the cache facts of a remote source and leaves out empty facts', async () => {
    const { view } = await build('dwd-hyras');

    expect(screen.getByRole('dialog', { name: 'DWD HYRAS-Tageswerte' })).toBeInTheDocument();
    expect(screen.getByText('https://example.org/dwd-hyras')).toBeInTheDocument();
    expect(screen.getByText('2014–2026')).toBeInTheDocument();
    expect(screen.getByText('aktuell')).toBeInTheDocument();
    expect(screen.queryByText('Zuletzt geändert')).not.toBeInTheDocument();
    expect(screen.queryByText('Fehler')).not.toBeInTheDocument();
    await noViolations(view.container);
  });

  it('shows the error and the change time of a failed source without years', async () => {
    const api = new RemoteApiDouble();
    api.remoteList = [
      {
        ...remoteOf('gbif-occurrences', 'failed'),
        years: [],
        lastChangedAt: '2026-10-04T03:30:00Z',
        error: 'timeout',
      },
    ];
    await build('gbif-occurrences', api);

    expect(screen.getByText('timeout')).toBeInTheDocument();
    expect(screen.getByText('Zuletzt geändert')).toBeInTheDocument();
    expect(screen.queryByText('Jahre im Speicher')).not.toBeInTheDocument();
  });

  it('shows no facts for a source that the list does not have', async () => {
    const api = new RemoteApiDouble();
    api.remoteList = [];
    await build('dwd-soil-moisture', api);

    expect(screen.getByRole('dialog', { name: 'DWD Bodenfeuchte' })).toBeInTheDocument();
    expect(screen.queryByText('Zustand')).not.toBeInTheDocument();
  });

  it('refreshes all years when the fields are empty or wrong', async () => {
    const { api } = await build('dwd-hyras');

    await userEvent.type(screen.getByRole('spinbutton', { name: 'Ab Jahr' }), '1800');
    await userEvent.click(screen.getByRole('button', { name: 'Jetzt aktualisieren' }));

    expect(api.actions).toEqual(['refresh:dwd-hyras']);
    expect(api.ranges).toEqual([{ fromYear: undefined, toYear: undefined }]);
  });

  it('refreshes a range of years and opens the fetch run', async () => {
    const { api, closed } = await build('dwd-hyras');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    await userEvent.type(screen.getByRole('spinbutton', { name: 'Ab Jahr' }), '2020');
    await userEvent.type(screen.getByRole('spinbutton', { name: 'Bis Jahr' }), ' 2024 ');
    await userEvent.click(screen.getByRole('button', { name: 'Jetzt aktualisieren' }));
    expect(api.ranges).toEqual([{ fromYear: 2020, toYear: 2024 }]);

    await userEvent.click(await screen.findByRole('button', { name: /Zum Abruf-Lauf/ }));

    expect(closed).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/verwaltung/laeufe', 'run-fetch']);
  });

  it('shows nothing without a source', async () => {
    await build(null);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps a run of another source out of this sheet', async () => {
    const { api } = await build('dwd-hyras');

    TestBed.inject(DataSourcesStore).refresh({ source: 'gbif-occurrences', range: {} });
    TestBed.tick();

    expect(api.actions).toEqual(['refresh:gbif-occurrences']);
    expect(screen.queryByRole('button', { name: /Zum Abruf-Lauf/ })).not.toBeInTheDocument();
  });
});
