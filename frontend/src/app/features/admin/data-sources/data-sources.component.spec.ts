import { signal, type EnvironmentProviders, type Provider } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { of } from 'rxjs';
import { DataSourcesApi } from '../../../core/api/data-sources.api';
import { noViolations } from '../../../testing/axe';
import { ANY_ROUTE } from '../../../testing/routes';
import { SpeciesState } from '../../species/species.state';
import { DataSourceComponent } from './data-source.component';
import { DataSourcesComponent } from './data-sources.component';
import { DataSourcesApiDouble } from './data-sources.testing';

function providers(api: DataSourcesApiDouble): (Provider | EnvironmentProviders)[] {
  return [
    provideRouter(ANY_ROUTE),
    { provide: DataSourcesApi, useValue: api },
    { provide: SpeciesState, useValue: { loadBundle: () => Promise.resolve(), species: signal([]) } },
  ];
}

describe('DataSourcesComponent', () => {
  it('shows the automatic and the uploaded sources with their states', async () => {
    const { container } = await render(DataSourcesComponent, {
      providers: providers(new DataSourcesApiDouble()),
    });

    expect(screen.getByText('Automatisch')).toBeInTheDocument();
    expect(screen.getByText('Hochgeladen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /DWD HYRAS-Tageswerte/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Baumraster.*bereit/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Standortraster.*fehlt/ })).toBeInTheDocument();
    await noViolations(container);
  });

  it('names each run kind with missing inputs in a banner', async () => {
    await render(DataSourcesComponent, { providers: providers(new DataSourcesApiDouble()) });

    expect(screen.getByText('Rendern: Eingaben fehlen')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Rendern: Eingaben fehlen'));

    const sheet = screen.getByRole('dialog', { name: 'Fehlende Eingaben' });
    expect(within(sheet).getAllByText('Standortraster')).toHaveLength(2);
  });

  it('opens the page of an uploaded kind', async () => {
    await render(DataSourcesComponent, { providers: providers(new DataSourcesApiDouble()) });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    await userEvent.click(screen.getByRole('button', { name: /Baumraster/ }));

    expect(navigate).toHaveBeenCalledWith(['/verwaltung/datenquellen', 'trees-grid']);
  });
});

describe('DataSourceComponent', () => {
  async function build(
    api = new DataSourcesApiDouble(),
  ): Promise<{ container: Element; api: DataSourcesApiDouble }> {
    const map = convertToParamMap({ kind: 'trees-grid' });
    const { container } = await render(DataSourceComponent, {
      providers: [
        ...providers(api),
        { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } },
      ],
    });
    TestBed.tick();
    return { container, api };
  }

  it('shows the format, the active metadata and the versions', async () => {
    const { container } = await build();

    expect(screen.getByText('Dateitypen')).toBeInTheDocument();
    expect(screen.getByText('EPSG:3035')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trees-v2\.parquet.*aktiv/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /trees-v1\.parquet.*abgelöst/ })).toBeInTheDocument();
    await noViolations(container);
  });

  it('activates an older version from its sheet', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: /trees-v1\.parquet/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Aktivieren' }));

    expect(api.actions).toEqual(['activate:v-1']);
  });

  it('asks before it deletes a version', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: /trees-v1\.parquet/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Version löschen' }));
    expect(api.actions).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    expect(api.actions).toEqual(['remove:v-1']);
  });

  it('loads older versions on request', async () => {
    const { api } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Ältere Versionen laden' }));

    expect(api.details).toContain('trees-grid@next');
    expect(screen.getByRole('button', { name: /trees-v0\.parquet/ })).toBeInTheDocument();
  });
});
