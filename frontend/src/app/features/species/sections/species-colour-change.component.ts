import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ColourChangeComponent } from '../../../ui/colour-change/colour-change.component';
import type { ColourValue } from '../../../ui/colour-field/colour-field.component';
import type { ColourChange } from '../../../core/api/models';
import type { TranslationKey } from '../../../core/i18n/translations';
import { PART_TEXT, SPEED_TEXT } from '../labels';

/** Die Dauer als Wort, wo es eines eigens für die Verfärbung gibt. */
const COLOUR_CHANGE_SPEED_TEXT: Partial<Record<ColourChange['speed'] & string, TranslationKey>> = {
  '30s': 'species.colourChange.speed.s30',
  '1min': 'species.colourChange.speed.min1',
  '3min': 'species.colourChange.speed.min3',
  longer: 'species.colourChange.speed.longer',
};

/** Eine Karte Verfärbung: der Teil und seine Zeilen. */
interface ChangeCard {
  part: string;
  triggers: string[];
  from: (readonly ColourValue[])[];
  to: (readonly ColourValue[])[];
  fromLabels: string[];
  toLabels: string[];
  speed: string[];
}

const SEPARATOR = ', ';

/** Die Verfärbungen einer Art, je Körperteil eine Karte. */
@Component({
  selector: 'app-species-colour-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourChangeComponent, TranslatePipe],
  templateUrl: './species-colour-change.component.html',
  styleUrl: './species-colour-change.component.scss',
})
export class SpeciesColourChangeComponent {
  private readonly i18n = inject(I18nService);

  readonly changes = input.required<readonly ColourChange[]>();

  protected readonly arrowLabel = computed(() => this.i18n.translate('common.to'));

  protected readonly cards = computed<ChangeCard[]>(() => {
    const byPart = new Map<string, ColourChange[]>();
    for (const change of this.changes()) {
      const held = byPart.get(change.part) ?? [];
      held.push(change);
      byPart.set(change.part, held);
    }
    return [...byPart].map(([part, rows]) => ({
      part: this.i18n.translate(PART_TEXT[part as ColourChange['part']]),
      triggers: rows.map((row) => row.triggers.map((term) => term.name).join(SEPARATOR)),
      from: rows.map((row) => (row.from ? [row.from] : [])),
      to: rows.map((row) => [row.to]),
      fromLabels: rows.map((row) => row.from?.name ?? ''),
      toLabels: rows.map((row) => row.to.name),
      speed: rows.map((row) => {
        if (!row.speed) return '';
        const key = COLOUR_CHANGE_SPEED_TEXT[row.speed] ?? SPEED_TEXT[row.speed];
        return this.i18n.translate(key);
      }),
    }));
  });
}
