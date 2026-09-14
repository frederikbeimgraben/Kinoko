import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Eine der zwölf Standardfarben. */
export interface ColourPickerSwatch {
  value: string;
  label: string;
}

/**
 * Zwölf Standardfarben mit Namen im Raster, eine gewählt. Darunter, wenn
 * vorhanden, die nächsten Farbtöne aus dem Katalog als reine Vorschau ohne
 * eigenen Namen. Ersetzt die frühere Palette mit 18 Feldern.
 */
@Component({
  selector: 'app-colour-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './colour-picker.component.html',
  styleUrl: './colour-picker.component.scss',
})
export class ColourPickerComponent {
  readonly colours = input.required<readonly ColourPickerSwatch[]>();
  readonly value = input<string | null>(null);
  readonly label = input.required<string>();
  /** Hex-Werte aus dem Katalog, dem gewählten Ton am nächsten. Nur Vorschau. */
  readonly nearest = input<readonly string[]>([]);

  readonly valueChange = output<string>();

  protected readonly hasNearest = computed(() => this.nearest().length > 0);
}
