import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { TagListComponent } from '../../../ui/tag-list/tag-list.component';
import type { SpeciesEntry } from '../../../core/api/models';

/** Ein Sinn mit seinen Marken und seinem Satz aus dem Katalog. */
interface Sense {
  titleKey: 'species.field.smell' | 'species.field.taste';
  tags: string[];
  text: string | null;
}

/** Geruch und Geschmack einer Art: Marken aus dem Katalog, darunter der Satz. */
@Component({
  selector: 'app-species-senses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TagListComponent, TranslatePipe],
  templateUrl: './species-senses.component.html',
  styleUrl: './species-senses.component.scss',
})
export class SpeciesSensesComponent {
  private readonly i18n = inject(I18nService);

  readonly species = input.required<SpeciesEntry>();

  protected readonly senses = computed<Sense[]>(() => {
    const held = this.species();
    const rows: Sense[] = [
      { titleKey: 'species.field.smell', tags: terms(held, 'smell'), text: held.smellText ?? null },
      { titleKey: 'species.field.taste', tags: terms(held, 'taste'), text: held.tasteText ?? null },
    ];
    return rows.filter((row) => row.tags.length > 0 || row.text !== null);
  });

  protected label(sense: Sense): string {
    return this.i18n.translate(sense.titleKey);
  }
}

/** Die Begriffe einer Art zu einer Art von Begriff. */
function terms(species: SpeciesEntry, kind: 'smell' | 'taste'): string[] {
  return species.terms.filter((entry) => entry.term.kind === kind).map((entry) => entry.term.name);
}
