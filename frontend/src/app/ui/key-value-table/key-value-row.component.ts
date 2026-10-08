import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, contentChild, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** A row of the trait table: the key at the left, one or more values at the right. */
@Component({
  selector: 'app-key-value-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, RouterLink],
  templateUrl: './key-value-row.component.html',
  styleUrl: './key-value-row.component.scss',
})
export class KeyValueRowComponent {
  readonly key = input.required<string>();
  readonly value = input<string>();
  /** Many values side by side, one column for each compared species. */
  readonly values = input<readonly string[]>();
  /** One slot for each column. The comparison puts a swatch, badge or bar into it. */
  readonly cells = input<readonly unknown[]>();
  /** When the key goes to a different page, it shows as a link. */
  readonly route = input<string | null>(null);
  /** A word next to the key that names the value. A swatch alone gives no meaning. */
  readonly hint = input<string | null>(null);
  /** A value ends at the right. Running text starts at the left. */
  readonly flow = input(false);
  /** The header row of a comparison. The values are the names of the columns. */
  readonly head = input(false);

  protected readonly slot = contentChild(TemplateRef);
}
