import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ChoiceRowComponent } from '../../ui/choice-row/choice-row.component';
import { choicesOf } from './filter-groups';
import { countUnknown } from './facets';
import { SpeciesFilterState } from './filter.state';
import { SpeciesState } from './species.state';
import type { GroupKey } from './facets';

/** Die Werte einer Filtergruppe, jeder mit der Zahl der Arten. */
@Component({
  selector: 'app-species-filter-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceRowComponent, TranslatePipe],
  templateUrl: './filter-group.component.html',
  styleUrl: './filter-group.component.scss',
})
export class SpeciesGroupComponent {
  private readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  protected readonly filter = inject(SpeciesFilterState);

  readonly group = input.required<GroupKey>();

  protected readonly names = computed<ReadonlyMap<string, string>>(() => {
    const found = new Map<string, string>();
    for (const one of this.state.entries()) {
      for (const held of one.species.terms) found.set(held.term.slug, held.term.name);
    }
    return found;
  });

  protected readonly choices = computed(() =>
    choicesOf(this.state.facets(), this.group(), this.i18n, this.names()),
  );

  /** Ohne Lücke im Katalog steht die Karte für fehlende Angaben nicht. */
  protected readonly hasGap = computed(() => countUnknown(this.state.facets(), this.group()) > 0);

  protected checked(value: string): boolean {
    return this.filter.chosenIn(this.group()).has(value);
  }
}
