import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { KeyValueRowComponent } from '../../../ui/key-value-table/key-value-row.component';
import { KeyValueTableComponent } from '../../../ui/key-value-table/key-value-table.component';
import type { SpeciesEntry } from '../../../core/api/models';
import type { TranslationKey } from '../../../core/i18n/translations';

/** Eine Stufe der Einordnung mit ihrem Weg. */
interface Step {
  labelKey: TranslationKey;
  name: string;
  route: string;
}

/** Wo eine Art steht: Gattung und Familie, beide führen weiter. */
@Component({
  selector: 'app-species-taxonomy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [KeyValueRowComponent, KeyValueTableComponent, TranslatePipe],
  templateUrl: './species-taxonomy.component.html',
  styleUrl: './species-taxonomy.component.scss',
})
export class SpeciesTaxonomyComponent {
  readonly species = input.required<SpeciesEntry>();

  protected readonly steps = computed<Step[]>(() => {
    const held = this.species();
    const rows: Step[] = [
      { labelKey: 'species.taxonomy.genus', name: held.genusName, route: route('genus', held.genusName) },
    ];
    if (held.familyName) {
      rows.push({
        labelKey: 'species.taxonomy.family',
        name: held.familyName,
        route: route('family', held.familyName),
      });
    }
    return rows;
  });
}

/** Der Weg einer Stufe. Der Slug folgt dem lateinischen Namen. */
function route(rank: string, name: string): string {
  return `/taxonomie/${rank}/${name.toLowerCase()}`;
}
