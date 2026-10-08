import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { SpeciesFilterChipsComponent, type ChipKey } from './filter-chips.component';
import { SpeciesStore } from './species.store';

/** A search field above the filter chips. The chips hide while a search text is present. */
@Component({
  selector: 'app-species-search-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SearchFieldComponent, SpeciesFilterChipsComponent],
  templateUrl: './search-filter-bar.component.html',
  styleUrl: './search-filter-bar.component.scss',
})
export class SpeciesSearchFilterBarComponent {
  private readonly catalogue = inject(SpeciesStore);

  readonly value = input('');
  readonly placeholder = input('');

  readonly valueChange = output<string>();
  /** The group whose chip the person pressed. It opens the filter sheet. */
  readonly groupOpened = output<ChipKey>();

  protected readonly showsMarks = computed(
    () => !this.catalogue.loading() && !this.catalogue.failed() && this.value().trim() === '',
  );
}
