import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import type { SpeciesEntry } from '../../../core/api/models';

/** Eine Quelle in der Zeile: der Titel führt zur Seite. */
interface SourceRow {
  title: string;
  url: string;
}

/** Die Quellen einer Art. Jede Zeile führt zu ihrer Seite. */
@Component({
  selector: 'app-species-sources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, TranslatePipe],
  templateUrl: './species-sources.component.html',
  styleUrl: './species-sources.component.scss',
})
export class SpeciesSourcesComponent {
  readonly species = input.required<SpeciesEntry>();

  protected readonly rows = computed<SourceRow[]>(() =>
    this.species().sources.map((one) => ({ title: one.title, url: one.url })),
  );

  protected open(url: string): void {
    globalThis.open(url, '_blank', 'noreferrer');
  }
}
