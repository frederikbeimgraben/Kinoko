import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { BodyPart, SpeciesEntry } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { PART_TEXT } from '../species/labels';
import { freeParts } from './species-lists';

/** Das Blatt zur Wahl weiterer Teile einer Art. */
@Component({
  selector: 'app-part-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OptionSheetComponent, TranslatePipe],
  templateUrl: './part-picker.component.html',
  styleUrl: './part-picker.component.scss',
})
export class PartPickerComponent {
  private readonly i18n = inject(I18nService);

  readonly open = input(false);
  readonly species = input<SpeciesEntry | null>(null);
  /** Teile, die schon gewählt sind und darum nicht mehr zur Wahl stehen. */
  readonly held = input<readonly BodyPart[]>([]);

  readonly chosen = output<readonly BodyPart[]>();
  readonly closed = output();

  protected readonly options = computed<readonly OptionSheetOption[]>(() =>
    freeParts(this.species(), this.held()).map((part) => ({
      id: part,
      title: this.i18n.translate(PART_TEXT[part]),
    })),
  );

  protected confirm(ids: readonly string[]): void {
    this.chosen.emit(ids as BodyPart[]);
  }
}
