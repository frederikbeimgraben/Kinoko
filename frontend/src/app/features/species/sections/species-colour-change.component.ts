import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { ColourChangeComponent } from '../../../ui/colour-change/colour-change.component';
import type { ColourValue } from '../../../ui/colour-field/colour-field.component';
import type { ColourChange } from '../../../core/api/models';
import { PART_TEXT, SPEED_TEXT } from '../labels';

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
  imports: [ColourChangeComponent],
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
      speed: rows.map((row) => (row.speed ? this.i18n.translate(SPEED_TEXT[row.speed]) : '')),
    }));
  });
}
