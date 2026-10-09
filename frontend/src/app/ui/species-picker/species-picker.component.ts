import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  computed,
  contentChild,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ScrollFadeDirective } from '../scroll-fade/scroll-fade.directive';
import { SearchFieldComponent } from '../search-field/search-field.component';
import {
  SpeciesRowComponent,
  speciesHasText,
  type SpeciesRowSpecies,
} from '../species-row/species-row.component';

/** A species as the picker needs it: the row and its key. */
export interface SpeciesPickerEntry extends SpeciesRowSpecies {
  readonly value: string;
}

/** A search field and species rows. The trailing slot of each row takes a template. */
@Component({
  selector: 'app-species-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ScrollFadeDirective, SearchFieldComponent, SpeciesRowComponent, TranslatePipe],
  templateUrl: './species-picker.component.html',
  styleUrl: './species-picker.component.scss',
})
export class SpeciesPickerComponent {
  readonly species = input.required<readonly SpeciesPickerEntry[]>();
  readonly selected = input<string | null>(null);
  readonly label = input.required<string>();

  /** Optional template for each row, with the `SpeciesPickerEntry` as `$implicit`. */
  readonly row = contentChild(TemplateRef);

  readonly chosen = output<string>();

  protected readonly query = signal('');

  protected readonly rows = computed(() => {
    const term = this.query().trim().toLocaleLowerCase();
    if (term === '') return this.species();
    return this.species().filter((entry) => speciesHasText(entry, term));
  });
}
