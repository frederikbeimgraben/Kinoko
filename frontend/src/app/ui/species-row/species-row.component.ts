import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { LevelPillComponent, type BadgeKind } from '../level-pill/level-pill.component';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Eine Art, wie sie die Artenzeile braucht. */
export interface SpeciesRowSpecies {
  readonly name: string;
  readonly latin: string;
  readonly levelText: string;
  readonly levelColour: string;
  readonly levelBackground?: string;
  /** Die Plakettenart, per `kit.css` `.badge`. Ohne Angabe gilt die freie Farbe. */
  readonly levelKind?: BadgeKind;
  /** Grundfarbe des Ersatzsymbols im Titelbild, ohne Foto. */
  readonly colour?: string;
  /** Der Weg zum Titelbild. Ohne Bild zeigt das Ersatzsymbol. */
  readonly image?: string | null;
}

/** Artenzeile, 72 px hoch: Titelbild, Name, Speisewert als feste Plakette. */
@Component({
  selector: 'app-species-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelPillComponent, PrivateImageComponent, RippleDirective, SvgIconComponent],
  templateUrl: './species-row.component.html',
  styleUrl: './species-row.component.scss',
})
export class SpeciesRowComponent {
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  readonly species = input.required<SpeciesRowSpecies>();
  readonly active = input(false);
  /** Eine Art ohne Angabe steht ohne Plakette und blass unter den Treffern. */
  readonly muted = input(false);

  readonly chosen = output();

  /** Setzt den Fokus auf die Zeile. Die Liste wandert damit per Pfeiltaste. */
  focus(): void {
    this.button().nativeElement.focus();
  }
}
