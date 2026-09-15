import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import {
  ColourFieldComponent,
  type ColourMode,
  type ColourValue,
} from '../../../ui/colour-field/colour-field.component';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import type { SpeciesEntry } from '../../../core/api/models';
import type { TranslationKey } from '../../../core/i18n/translations';
import { ATTACHMENT_TEXT, EDGE_TEXT, HYMENIUM_TEXT, SPACING_TEXT } from '../labels';

/** Eine Zeile der Fruchtschicht mit ihrem Wort. */
interface HymeniumRow {
  labelKey: TranslationKey;
  value: string;
}

/** Nur Lamellen tragen Ansatz, Stand und Schneide. */
const GILL_ONLY: SpeciesEntry['hymeniumType'][] = ['gills', 'folds'];

/** Die Fruchtschicht einer Art: Art, Bau und Farbe. */
@Component({
  selector: 'app-species-hymenium',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourFieldComponent, ListRowComponent, TranslatePipe],
  templateUrl: './species-hymenium.component.html',
  styleUrl: './species-hymenium.component.scss',
})
export class SpeciesHymeniumComponent {
  private readonly i18n = inject(I18nService);

  readonly species = input.required<SpeciesEntry>();

  protected readonly rows = computed<HymeniumRow[]>(() => {
    const held = this.species();
    const kind = held.hymeniumType ?? null;
    if (kind === null) return [];
    const rows: HymeniumRow[] = [
      { labelKey: 'species.fieldLabel', value: this.i18n.translate(HYMENIUM_TEXT[kind]) },
    ];
    if (!GILL_ONLY.includes(kind)) return rows;
    if (held.gillAttachment)
      rows.push({
        labelKey: 'species.field.hymeniumAttachment',
        value: this.i18n.translate(ATTACHMENT_TEXT[held.gillAttachment]),
      });
    if (held.gillSpacing)
      rows.push({
        labelKey: 'species.field.hymeniumStand',
        value: this.i18n.translate(SPACING_TEXT[held.gillSpacing]),
      });
    if (held.gillEdge)
      rows.push({
        labelKey: 'species.field.hymeniumEdge',
        value: this.i18n.translate(EDGE_TEXT[held.gillEdge]),
      });
    return rows;
  });

  protected readonly colours = computed<readonly ColourValue[]>(() => this.group()?.colours ?? []);

  protected readonly mode = computed<ColourMode>(() => {
    const mode = this.group()?.mode;
    return mode === 'gradient' ? 'gradient' : mode === 'single' ? 'single' : 'multiple';
  });

  protected readonly colourLabel = computed(() =>
    this.colours()
      .map((colour) => colour.name)
      .join(', '),
  );

  /** Die Farbe der Fruchtschicht steht an demselben Körperteil. */
  private readonly group = computed(() => {
    const kind = this.species().hymeniumType;
    if (!kind) return null;
    return this.species().colours.find((one) => one.part === kind) ?? null;
  });
}
