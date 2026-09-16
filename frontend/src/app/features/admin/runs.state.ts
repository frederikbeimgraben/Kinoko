import { Injectable, inject, signal } from '@angular/core';
import { RunsApi } from '../../core/api/runs.api';
import type { PipelineRun, RunKind } from '../../core/api/models';

/** Die Liste der Läufe. Ein angestoßener Lauf steht sofort vorn. */
@Injectable({ providedIn: 'root' })
export class RunsState {
  private readonly api = inject(RunsApi);
  private readonly _runs = signal<PipelineRun[] | null>(null);

  readonly runs = this._runs.asReadonly();

  load(): void {
    this.api.list().subscribe((runs) => {
      this._runs.set(runs);
    });
  }

  start(kind: RunKind): void {
    this.api.create(kind).subscribe((run) => {
      this._runs.update((runs) => [run, ...(runs ?? [])]);
    });
  }
}
