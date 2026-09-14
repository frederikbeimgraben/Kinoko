import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SearchFieldComponent } from '../search-field/search-field.component';
import { SpeciesRowComponent, type SpeciesRowSpecies } from '../species-row/species-row.component';

/** Eine Art, wie die Wahl sie braucht: die Zeile plus ihr Schlüssel. */
export interface SpeciesPickerEntry extends SpeciesRowSpecies {
  readonly value: string;
}

/**
 * Suchfeld plus Artenzeilen, für die Kartenwahl und ähnliche Sheets. Der
 * Slot vor den Zeilen nimmt eine Saisonkurve zur gerade gewählten Art auf.
 */
@Component({
  selector: 'app-species-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchFieldComponent, SpeciesRowComponent, TranslatePipe],
  templateUrl: './species-picker.component.html',
  styleUrl: './species-picker.component.scss',
})
export class SpeciesPickerComponent {
  readonly species = input.required<readonly SpeciesPickerEntry[]>();
  readonly selected = input<string | null>(null);
  readonly label = input.required<string>();

  readonly chosen = output<string>();

  protected readonly query = signal('');

  protected readonly rows = computed(() => {
    const term = this.query().trim().toLocaleLowerCase();
    if (term === '') return this.species();
    return this.species().filter(
      (entry) =>
        entry.name.toLocaleLowerCase().includes(term) || entry.latin.toLocaleLowerCase().includes(term),
    );
  });
}
