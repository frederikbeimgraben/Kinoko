import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ColourPickerComponent } from '../../ui/colour-picker/colour-picker.component';
import { ExpandRowComponent } from '../../ui/expand-row/expand-row.component';
import { FoldSectionComponent } from '../../ui/fold-section/fold-section.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { BodyPart } from '../../core/api/models';
import { countColours, nearestColour, nearestTones } from './facets';
import { partsWithColour, tonesOf } from './filter-groups';
import { SpeciesFilterStore } from './filter.store';
import { COLOUR_PARTS, COLOUR_TEXT, PART_TEXT } from './labels';
import { SpeciesStore } from './species.store';
import { ViewportService } from '../../core/layout/viewport.service';

const TONES = 6;

/** The colour choice for each body part, as fold rows in the colour section. */
@Component({
  selector: 'app-species-filter-colour',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourPickerComponent, ExpandRowComponent, FoldSectionComponent, TranslatePipe],
  templateUrl: './filter-colour.component.html',
  styleUrl: './filter-colour.component.scss',
})
export class SpeciesColourComponent {
  private readonly state = inject(SpeciesStore);
  private readonly i18n = inject(I18nService);
  protected readonly filter = inject(SpeciesFilterStore);
  protected readonly wide = inject(ViewportService).wide;

  private readonly opened = signal<BodyPart | null>(null);

  protected readonly swatches = computed(() =>
    this.state.palette().map((colour) => ({
      value: colour.hex,
      label: this.i18n.translate(COLOUR_TEXT[colour.key]),
    })),
  );

  protected readonly parts = computed(() =>
    partsWithColour(this.state.facets(), COLOUR_PARTS).map((part) => ({
      part,
      // The gill colour stands for the colour of all hymenium kinds, so the board says "Fruchtschicht".
      label: this.i18n.translate(part === 'gills' ? 'species.section.hymenium' : PART_TEXT[part]),
      chosen: this.filter.colourOf(part),
      name: this.nameOf(part),
      open: this.open() === part,
    })),
  );

  /** Without a choice of the person, the first part is open, as on the board. */
  protected readonly open = computed<BodyPart | null>(
    () => this.opened() ?? partsWithColour(this.state.facets(), COLOUR_PARTS).at(0) ?? null,
  );

  protected readonly tones = computed(() => {
    const part = this.open();
    const hex = part === null ? null : this.filter.colourOf(part);
    if (part === null || hex === null) return [];
    return nearestTones(tonesOf(this.state.entries(), part), hex, TONES);
  });

  protected readonly tonesLabel = computed(() => {
    const head = this.i18n.translate('filter.colour.nextTones');
    const count = this.i18n.translate('filter.countSpecies', { anzahl: String(this.wearing()) });
    return `${head} \u00b7 ${count}`;
  });

  protected toggle(part: BodyPart): void {
    this.opened.set(this.open() === part ? null : part);
  }

  protected choose(part: BodyPart, hex: string): void {
    this.filter.setColour(part, hex);
  }

  /** The count of species with this tone on the body part. */
  private wearing(): number {
    const part = this.open();
    const hex = part === null ? null : this.filter.colourOf(part);
    if (part === null || hex === null) return 0;
    const key = nearestColour(hex, this.state.palette())?.key ?? '';
    return countColours(this.state.facets(), part)[key] ?? 0;
  }

  private nameOf(part: BodyPart): string {
    const hex = this.filter.colourOf(part);
    const colour = this.state.palette().find((one) => one.hex === hex);
    return colour === undefined ? '' : this.i18n.translate(COLOUR_TEXT[colour.key]);
  }
}
