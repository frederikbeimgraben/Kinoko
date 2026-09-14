import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import { LevelPillComponent } from '../level-pill/level-pill.component';

/** Ohne eigene Töne trägt das Feld die Farben eines Waldbodens. */
const DEFAULT_TINT: readonly [string, string] = ['#4a5a3a', '#8a9a5a'];

/** Eine Art, wie sie die Artenzeile braucht. */
export interface SpeciesRowSpecies {
  readonly name: string;
  readonly latin: string;
  readonly levelText: string;
  readonly levelColour: string;
  readonly image?: string | null;
  /** Zwei Töne für das Feld, solange kein Bild vorliegt. */
  readonly tint?: readonly [string, string];
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

  /** Der Verlauf des Platzhalters, dunkel nach hell. */
  protected readonly gradient = computed(() => {
    const [from, to] = this.species().tint ?? DEFAULT_TINT;
    return `linear-gradient(140deg, ${from}, ${to})`;
  });

  protected readonly patches = computed(() => {
    const [from, to] = this.species().tint ?? DEFAULT_TINT;
    return [
      { background: to, left: '10%', top: '20%', width: '60%', height: '60%' },
      { background: from, left: '55%', top: '45%', width: '50%', height: '55%' },
    ];
  });

  /** Setzt den Fokus auf die Zeile. Die Liste wandert damit per Pfeiltaste. */
  focus(): void {
    this.button().nativeElement.focus();
  }
}
