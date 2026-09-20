import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** A labelled group of content, per `kit.css` `.sec`. */
@Component({
  selector: 'app-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './section.component.html',
  styleUrl: './section.component.scss',
})
export class SectionComponent {
  readonly label = input.required<string>();
}
