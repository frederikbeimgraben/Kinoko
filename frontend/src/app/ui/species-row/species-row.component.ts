import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { shareOnNextRoute } from '../../core/navigation/shared-element';
import { RippleDirective } from '../ripple/ripple.directive';
import { LevelPillComponent, type BadgeKind } from '../level-pill/level-pill.component';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** A species as the species row needs it. */
export interface SpeciesRowSpecies {
  readonly name: string;
  readonly latin: string;
  readonly levelText: string;
  readonly levelColour: string;
  readonly levelBackground?: string;
  /** The badge kind, per `kit.css` `.badge`. Without a kind the free colour applies. */
  readonly levelKind?: BadgeKind;
  /** The base colour of the fallback icon in the thumb, without a photo. */
  readonly colour?: string;
  /** The path to the lead photo. Without a photo the fallback icon shows. */
  readonly image?: string | null;
}

/** The species row, 72 px high: thumb, names and the edibility badge, per `SpeciesRow.dc.html`. */
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

  /** Puts the focus on the row. The list moves with the arrow keys this way. */
  focus(): void {
    this.button().nativeElement.focus();
  }

  protected choose(): void {
    const key = this.shareKey();
    if (key !== undefined) shareOnNextRoute(this.thumb().nativeElement as HTMLElement, key);
    this.chosen.emit();
  }
}
