import { ChangeDetectionStrategy, Component, ElementRef, input, output, viewChild } from '@angular/core';
import { LevelPillComponent } from '../level-pill/level-pill.component';

/** Eine Art, wie sie die Artenzeile braucht. */
export interface SpeciesRowSpecies {
  readonly name: string;
  readonly latin: string;
  readonly levelText: string;
  readonly levelColour: string;
  readonly image?: string | null;
}

/** Artenzeile, 62 px hoch: Name, Speisewert als feste Plakette, Bild rechts. */
@Component({
  selector: 'app-species-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelPillComponent],
  templateUrl: './species-row.component.html',
  styleUrl: './species-row.component.scss',
})
export class SpeciesRowComponent {
  private readonly button = viewChild.required<ElementRef<HTMLButtonElement>>('button');

  readonly species = input.required<SpeciesRowSpecies>();
  readonly active = input(false);

  readonly chosen = output();

  /** Setzt den Fokus auf die Zeile. Die Liste wandert damit per Pfeiltaste. */
  focus(): void {
    this.button().nativeElement.focus();
  }
}
