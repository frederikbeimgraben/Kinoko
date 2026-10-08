import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ChoiceRowComponent } from '../../ui/choice-row/choice-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import type { SpeciesPickerEntry } from '../../ui/species-picker/species-picker.component';

/** The species of the map as a search bar and a group of radio rows, per the board `SpeciesPickBody`. */
@Component({
  selector: 'app-species-pick',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChoiceRowComponent, RowGroupComponent, SearchFieldComponent, TranslatePipe],
  template: `
    <div class="pick__bar">
      <app-search-field
        [value]="query()"
        [placeholder]="'species.search.placeholder' | t"
        (valueChange)="query.set($event)"
      />
    </div>
    <app-row-group role="radiogroup" [attr.aria-label]="label()">
      @for (entry of rows(); track entry.value) {
        <app-choice-row
          [label]="entry.name"
          [subline]="entry.latin"
          [checked]="entry.value === selected()"
          (toggled)="chosen.emit(entry.value)"
        />
      } @empty {
        <p class="pick__empty">{{ 'state.noSpeciesMatch' | t }}</p>
      }
    </app-row-group>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    /* Per SpeciesPickBody.dc.html: the kit .bar of 72 px with its own margins. */
    .pick__bar {
      display: flex;
      align-items: center;
      block-size: 72px;
      margin: -4px -8px 0 -16px;
      padding: 0 8px 0 16px;
    }

    .pick__empty {
      margin: 0;
      padding: 16px 4px;
      color: var(--text-var);
    }
  `,
})
export class SpeciesPickComponent {
  readonly species = input.required<readonly SpeciesPickerEntry[]>();
  readonly selected = input<string | null>(null);
  readonly label = input.required<string>();

  readonly chosen = output<string>();

  protected readonly query = signal('');

  protected readonly rows = computed(() => {
    const needle = this.query().trim().toLowerCase();
    return needle === ''
      ? this.species()
      : this.species().filter((entry) => `${entry.name} ${entry.latin}`.toLowerCase().includes(needle));
  });
}
