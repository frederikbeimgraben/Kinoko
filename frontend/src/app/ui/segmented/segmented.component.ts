import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Eine Wahl im Segmented. */
export interface SegmentOption {
  value: string;
  label: string;
}

/**
 * Zwei, drei oder vier Wahlmöglichkeiten nebeneinander, Rolle `tablist`.
 * Pfeiltasten wechseln die Wahl. Ein gesperrtes Segment zeigt nur die Form,
 * ohne Tipp oder Fokus anzunehmen.
 */
@Component({
  selector: 'app-segmented',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './segmented.component.html',
  styleUrl: './segmented.component.scss',
})
export class SegmentedComponent {
  readonly options = input.required<readonly SegmentOption[]>();
  readonly value = input<string | null>(null);
  readonly label = input.required<string>();
  /** Ein gesperrtes Segment ist nur zu sehen, nicht zu bedienen. */
  readonly locked = input(false);

  readonly valueChange = output<string>();

  protected onKey(event: KeyboardEvent, index: number): void {
    if (this.locked()) return;
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    const options = this.options();
    const target = (index + step + options.length) % options.length;
    event.preventDefault();
    this.valueChange.emit(options[target].value);
  }
}
