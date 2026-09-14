import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ColourPickerComponent } from '../../ui/colour-picker/colour-picker.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import type { BodyPart } from '../../core/api/models';
import { countColours } from './facets';
import { colourParts, tonesOf } from './filter-groups';
import { SpeciesFilterState } from './filter.state';
import { COLOUR_PARTS, COLOUR_TEXT, PART_TEXT } from './labels';
import { SpeciesState } from './species.state';
import { STANDARD_COLOURS, nearestColour, nearestTones } from './standard-colours';

const TONES = 6;

/** Die Farbwahl je Körperteil. Ein Teil steht offen, die anderen zusammen. */
@Component({
  selector: 'app-species-colour',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourPickerComponent, SvgIconComponent],
  templateUrl: './filter-colour.component.html',
  styleUrl: './filter-colour.component.scss',
})
export class SpeciesColourComponent {
  private readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  protected readonly filter = inject(SpeciesFilterState);

  private readonly opened = signal<BodyPart | null>(null);

  protected readonly swatches = STANDARD_COLOURS.map((colour) => ({
    value: colour.hex,
    label: this.i18n.translate(COLOUR_TEXT[colour.key]),
  }));

  protected readonly parts = computed(() =>
    colourParts(this.state.entries(), COLOUR_PARTS).map((part) => ({
      part,
      label: this.i18n.translate(PART_TEXT[part]),
      chosen: this.filter.colourOf(part),
      name: this.nameOf(part),
      open: this.open() === part,
    })),
  );

  /** Ohne eigene Wahl steht der erste Teil offen, wie im Brett. */
  protected readonly open = computed<BodyPart | null>(
    () => this.opened() ?? colourParts(this.state.entries(), COLOUR_PARTS).at(0) ?? null,
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

  /** Wie viele Arten diesen Ton am Körperteil tragen. */
  private wearing(): number {
    const part = this.open();
    const hex = part === null ? null : this.filter.colourOf(part);
    if (part === null || hex === null) return 0;
    const key = nearestColour(hex).key;
    return countColours(this.state.facts(), part).get(key) ?? 0;
  }

  private nameOf(part: BodyPart): string {
    const hex = this.filter.colourOf(part);
    const colour = STANDARD_COLOURS.find((one) => one.hex === hex);
    return colour === undefined ? '' : this.i18n.translate(COLOUR_TEXT[colour.key]);
  }
}
