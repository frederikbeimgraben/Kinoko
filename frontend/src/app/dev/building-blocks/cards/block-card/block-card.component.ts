import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One pixel-test slot: exact size, the app background, one baseline. */
@Component({
  selector: 'app-block-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './block-card.component.html',
  styleUrl: './block-card.component.scss',
})
export class BlockCardComponent {
  readonly block = input.required<string>();
  readonly width = input.required<number>();
  readonly height = input.required<number>();
}
