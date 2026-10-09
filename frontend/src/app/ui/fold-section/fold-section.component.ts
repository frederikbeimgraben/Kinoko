import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

let nextId = 0;

/** A section that its header opens and closes, as `kit.css` `.sec`, `.lbl.fold`. */
@Component({
  selector: 'app-fold-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './fold-section.component.html',
  styleUrl: './fold-section.component.scss',
})
export class FoldSectionComponent {
  readonly label = input.required<string>();
  readonly open = model(true);

  protected readonly contentId = `fold-abschnitt-${(nextId += 1)}`;

  protected toggle(): void {
    this.open.set(!this.open());
  }
}
