import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

let nextId = 0;

/** Ein Abschnitt, den seine Kopfzeile auf- und zuklappt. Per `kit.css` `.sec`, `.lbl.fold`. */
@Component({
  selector: 'app-fold-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent],
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
