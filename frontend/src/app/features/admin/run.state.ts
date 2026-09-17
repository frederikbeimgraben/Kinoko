import { Injectable, inject, signal } from '@angular/core';
import { RunsApi } from '../../core/api/runs.api';
import type { PipelineRunDetail } from '../../core/api/models';

/** Ein Lauf mit seinen Schritten und seiner Ausgabe. */
@Injectable({ providedIn: 'root' })
export class RunState {
  private readonly api = inject(RunsApi);
  private readonly _id = signal('');
  private readonly _run = signal<PipelineRunDetail | null>(null);

  readonly run = this._run.asReadonly();

  /** Lädt einen Lauf. Ein zweiter Aufruf zum selben Lauf ruht. */
  load(id: string): void {
    if (this._id() === id) return;
    this._id.set(id);
    this._run.set(null);
    this.api.get(id).subscribe((run) => {
      if (this._id() === id) this._run.set(run);
    });
  }
}
