import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of, type Observable } from 'rxjs';
import { DataSourcesApi } from '../../../core/api/data-sources.api';
import { ANY_ROUTE } from '../../../testing/routes';
import { DataSourcesStore } from './data-sources.store';
import { DataSourcesApiDouble, versionOf } from './data-sources.testing';
import { VersionSheetComponent } from './version-sheet.component';

/** The double gives a log that each test sets. */
class LogApiDouble extends DataSourcesApiDouble {
  lines: string[] = ['line one', 'line two'];

  override log(): Observable<string[]> {
    return of(this.lines);
  }
}

async function build(versionId: string, api = new LogApiDouble()) {
  const closed = vi.fn();
  const view = await render(VersionSheetComponent, {
    inputs: { versionId },
    on: { closed },
    providers: [provideRouter(ANY_ROUTE), { provide: DataSourcesApi, useValue: api }],
  });
  TestBed.inject(DataSourcesStore).openDetail({ kind: 'trees-grid' });
  TestBed.tick();
  view.detectChanges();
  return { api, closed, view };
}

describe('VersionSheetComponent', () => {
  it('offers no activation for the active version', async () => {
    await build('v-2');

    expect(screen.getByRole('dialog', { name: 'Version 2' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aktivieren' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Neu verarbeiten' })).toBeInTheDocument();
  });

  it('offers no activation for a failed version', async () => {
    const api = new LogApiDouble();
    api.versions = [versionOf('v-3', 3, 'failed')];
    await build('v-3', api);

    expect(screen.queryByRole('button', { name: 'Aktivieren' })).not.toBeInTheDocument();
  });

  it('reprocesses a version', async () => {
    const { api } = await build('v-1');

    await userEvent.click(screen.getByRole('button', { name: 'Neu verarbeiten' }));

    expect(api.actions).toEqual(['reprocess:v-1']);
  });

  it('opens and closes the log', async () => {
    await build('v-1');

    await userEvent.click(screen.getByRole('button', { name: 'Protokoll' }));
    expect(screen.getByText(/line one/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Protokoll' }));
    expect(screen.queryByText(/line one/)).not.toBeInTheDocument();
  });

  it('says when the log is empty', async () => {
    const api = new LogApiDouble();
    api.lines = [];
    await build('v-1', api);

    await userEvent.click(screen.getByRole('button', { name: 'Protokoll' }));

    expect(screen.getByText('Kein Protokoll')).toBeInTheDocument();
  });

  it('closes after a confirmed delete', async () => {
    const { api, closed } = await build('v-1');

    await userEvent.click(screen.getByRole('button', { name: 'Version löschen' }));
    expect(screen.getByText('Version 1 löschen?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));

    expect(api.actions).toEqual(['remove:v-1']);
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('keeps the sheet open when the delete question is cancelled', async () => {
    const { api, closed } = await build('v-1');

    await userEvent.click(screen.getByRole('button', { name: 'Version löschen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(api.actions).toEqual([]);
    expect(closed).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Version 1' })).toBeInTheDocument();
  });

  it('shows nothing for an unknown version', async () => {
    await build('v-9');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
