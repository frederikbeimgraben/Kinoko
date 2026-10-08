import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';

/** One of the twelve standard colours. */
export interface ColourPickerSwatch {
  value: string;
  label: string;
}

/** Twelve named standard colours. The nearest catalogue tones show below them. */
@Component({
  selector: 'app-colour-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective],
  templateUrl: './colour-picker.component.html',
  styleUrl: './colour-picker.component.scss',
})
export class ColourPickerComponent {
  readonly colours = input.required<readonly ColourPickerSwatch[]>();
  readonly value = input<string | null>(null);
  readonly label = input.required<string>();
  /** Catalogue hex values nearest to the selected tone. For preview only. */
  readonly nearest = input<readonly string[]>([]);
  readonly nearestLabel = input<string>('');
  /** When false, only the area shows. Assistive technology still gets the name. */
  readonly labels = input(true);

  readonly valueChange = output<string>();

  protected readonly hasNearest = computed(() => this.nearest().length > 0);
}
