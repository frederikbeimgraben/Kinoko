import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { DEFAULT_LOCALE } from '../../core/i18n/translations';
import { shareOnNextRoute } from '../../core/navigation/shared-element';
import { RippleDirective } from '../ripple/ripple.directive';
import { LevelPillComponent, type BadgeKind } from '../level-pill/level-pill.component';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** A species as the species row needs it. */
export interface SpeciesRowSpecies {
  readonly name: string;
  readonly latin: string;
  /** The German catalogue name under a Latin title, per `features/species/species-names.ts`. */
  readonly alias?: string;
  readonly levelText: string;
  readonly levelColour: string;
  readonly levelBackground?: string;
  /** The badge kind, per `kit.css` `.badge`. Without a kind the free colour applies. */
  readonly levelKind?: BadgeKind;
  /** The base colour of the fallback icon in the thumb, without a photo. */
  readonly colour?: string;
  /** The path to the lead photo. Without a photo the fallback icon shows. */
  readonly image?: string | null;
  /** The label of the map mark of a species with a forecast. Without a label the row has no mark. */
  readonly forecastLabel?: string;
}

/** The second line under the name: the Latin name, or the German name where the title is the Latin name. */
export function speciesSubline(species: SpeciesRowSpecies): string {
  return species.latin !== species.name ? species.latin : (species.alias ?? '');
}

/** True when the name, the Latin name or the German name has the search text. */
export function speciesHasText(species: SpeciesRowSpecies, term: string): boolean {
  const needle = term.trim().toLocaleLowerCase();
  return [species.name, species.latin, species.alias ?? ''].some((one) =>
    one.toLocaleLowerCase().includes(needle),
  );
}

/** The species row, 72 px high: thumb, names, the map mark and the edibility badge, per `SpeciesRow.dc.html`. */
@Component({
  selector: 'app-species-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelPillComponent, PrivateImageComponent, RippleDirective, SvgIconComponent],
  templateUrl: './species-row.component.html',
  styleUrl: './species-row.component.scss',
})
export class SpeciesRowComponent {
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');
  private readonly thumb = viewChild.required('thumb', { read: ElementRef<HTMLElement> });

  readonly species = input.required<SpeciesRowSpecies>();
  readonly active = input(false);
  /** The kit `.item.soft` ground, for example for the species that the person opened last. */
  readonly soft = input(false);
  /** A species without data stands without a badge and pale below the hits. */
  readonly muted = input(false);
  /** The key of the shared-element move from the thumb to the hero of the next page. */
  readonly shareKey = input<string>();

  readonly chosen = output();

  /** The German catalogue name keeps its language for a screen reader. */
  protected readonly aliasLang = DEFAULT_LOCALE;

  /** Puts the focus on the row. The list moves with the arrow keys this way. */
  constructor() {
    // The selected species of a long list can be far down, for example after a link to a comparison.
    // A row that the list shows in full stays where it is; another row moves to the middle.
    afterRenderEffect(() => {
      const row = this.button().nativeElement;
      if (this.active() && !shownInFull(row)) row.scrollIntoView({ block: 'center' });
    });
  }

  focus(): void {
    this.button().nativeElement.focus();
  }

  protected choose(): void {
    const key = this.shareKey();
    if (key !== undefined) shareOnNextRoute(this.thumb().nativeElement as HTMLElement, key);
    this.chosen.emit();
  }
}

/** True when the box that scrolls the row shows all of the row. */
function shownInFull(row: HTMLElement): boolean {
  let box = row.parentElement;
  while (box !== null && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) box = box.parentElement;
  const view = box?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight);
  const own = row.getBoundingClientRect();
  return own.top >= view.top && own.bottom <= view.bottom;
}
