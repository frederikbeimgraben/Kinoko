import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Die letzte Zeile einer Liste: sie legt einen weiteren Eintrag an. */
@Component({
  selector: 'app-add-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './add-row.component.html',
  styleUrl: './add-row.component.scss',
})
export class AddRowComponent {
  /** Das Wort in der Zeile: was ein Druck anlegt. */
  readonly label = input.required<string>();
  /** Der barrierefreie Name. Er nennt die Handlung, nicht nur die Sache. */
  readonly action = input.required<string>();

  readonly pressed = output();
}
