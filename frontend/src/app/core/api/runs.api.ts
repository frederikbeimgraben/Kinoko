import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { ApiClient } from './api-client';
import type { Items, PipelineRun, PipelineRunDetail, RunKind } from './models';

const RUNS_PATH = '/pipeline-runs';

/** The pipeline runs. Each endpoint needs the `run.manage` permission. */
@Injectable({ providedIn: 'root' })
export class RunsApi {
  private readonly api = inject(ApiClient);

  list(): Observable<PipelineRun[]> {
    return this.api.get<Items<PipelineRun>>(RUNS_PATH).pipe(map((page) => page.items));
  }

  get(id: string): Observable<PipelineRunDetail> {
    return this.api.get<PipelineRunDetail>(`${RUNS_PATH}/${encodeURIComponent(id)}`);
  }

  /** Starts a run. The response contains the new run. */
  create(kind: RunKind): Observable<PipelineRun> {
    return this.api.post<PipelineRun>(RUNS_PATH, { kind });
  }
}
