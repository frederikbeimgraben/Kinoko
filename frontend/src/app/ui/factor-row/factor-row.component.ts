import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Ein Faktor der Kombination: Name, Bereich und Bedingung. */
export interface CombinationFactor {
  readonly name: string;
  readonly range?: string;
  readonly condition: string;
}

/** Zeile eines Faktors: Zeichen der Gruppe, Name mit Bereich, Bedingung, X. */
@Component({
  selector: 'app-factor-row',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, SvgIconComponent],
  templateUrl: './factor-row.component.html',
  styleUrl: './factor-row.component.scss',
})
export class FactorRowComponent {
  readonly factor = input.required<CombinationFactor>();
  /** Das Zeichen der Ebenengruppe vor dem Namen. */
  readonly icon = input<IconName>();
  /** Der barrierefreie Name des Knopfs, der den Faktor entfernt. */
  readonly removeLabel = input.required<string>();

  readonly conditionClick = output();
  readonly remove = output();
}
