import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import type { SpeciesEntry } from '../../../core/api/models';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { CatalogueText } from '../catalogue-text';

/** A sense with the text below its name. */
interface Sense {
  titleKey: 'species.field.smell' | 'species.field.taste';
  text: string;
}

/** Smell and taste of a species per `SpeciesSections.dc.html`: a row for each, with the sentence below. */
@Component({
  selector: 'app-species-senses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, RowGroupComponent, SectionComponent, TranslatePipe],
  templateUrl: './species-senses.component.html',
  styleUrl: './species-senses.component.scss',
})
export class SpeciesSensesComponent {
  private readonly names = inject(CatalogueText);

  readonly species = input.required<SpeciesEntry>();

  protected readonly senses = computed<Sense[]>(() => {
    const held = this.species();
    const rows: Sense[] = [
      { titleKey: 'species.field.smell', text: this.text(held, 'smell', held.smellText) },
      { titleKey: 'species.field.taste', text: this.text(held, 'taste', held.tasteText) },
    ];
    return rows.filter((row) => row.text !== '');
  });

  /** The catalogue sentence is German. In another language, the translated terms take its place. */
  private text(species: SpeciesEntry, kind: 'smell' | 'taste', sentence: string | null | undefined): string {
    const tags = this.names.termList(
      species.terms.filter((entry) => entry.term.kind === kind).map((entry) => entry.term),
    );
    const text = sentence !== null && sentence !== undefined && sentence !== '' ? sentence : tags;
    return this.names.free(text, tags);
  }
}
