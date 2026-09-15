import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/** Eine der zwölf Standardfarben. */
export interface ColourPickerSwatch {
  value: string;
  label: string;
}

/**
 * Zwölf Standardfarben mit Namen. Darunter stehen die nächsten Katalogtöne.
 */
@Component({
  selector: 'app-colour-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './colour-picker.component.html',
  styleUrl: './colour-picker.component.scss',
})
export class ColourPickerComponent {
  readonly colours = input.required<readonly ColourPickerSwatch[]>();
  readonly value = input<string | null>(null);
  readonly label = input.required<string>();
  /** Hex-Werte aus dem Katalog, dem gewählten Ton am nächsten. Nur Vorschau. */
  readonly nearest = input<readonly string[]>([]);
  /** Die Überschrift über den Katalogtönen. */
  readonly nearestLabel = input<string>('');

  readonly valueChange = output<string>();

  protected readonly hasNearest = computed(() => this.nearest().length > 0);
}
