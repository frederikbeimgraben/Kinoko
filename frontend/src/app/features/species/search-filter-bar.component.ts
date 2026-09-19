import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FilterChipComponent } from '../../ui/filter-chip/filter-chip.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { chipsOf, type FilterChip } from './chips';
import { isActive } from './facets';
import { SpeciesFilterState } from './filter.state';
import { SpeciesState } from './species.state';

/** Suchfeld, Filter-Knopf und aktive Filter-Marken, gemeinsam für Arten-Reiter und -Verwaltung. */
@Component({
  selector: 'app-species-search-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterChipComponent, SearchFieldComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './search-filter-bar.component.html',
  styleUrl: './search-filter-bar.component.scss',
})
export class SpeciesSearchFilterBarComponent {
  protected readonly state = inject(SpeciesState);
  protected readonly filter = inject(SpeciesFilterState);
  private readonly i18n = inject(I18nService);

  readonly value = input('');
  readonly placeholder = input('');

  readonly valueChange = output<string>();

  protected readonly filtered = computed(() => isActive(this.filter.selection()));

  protected readonly chips = computed<readonly FilterChip[]>(() =>
    chipsOf(this.filter.selection(), this.state.entries(), this.state.palette(), this.i18n),
  );

  protected readonly showsMarks = computed(
    () => !this.state.loading() && !this.state.failed() && this.value().trim() === '',
  );

  protected drop(chip: FilterChip): void {
    if (chip.part === null) this.filter.dropValue(chip.group, chip.value);
    else this.filter.dropColour(chip.part);
  }
}
