import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Block of fixed-width output text, per `kit.css` `.mono`. */
@Component({
  selector: 'app-mono',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './mono.component.html',
  styleUrl: './mono.component.scss',
})
export class MonoComponent {
  readonly text = input.required<string>();
}
