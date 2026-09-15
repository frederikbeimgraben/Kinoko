import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Ein Zurück-Pfeil vor einem Titel, für ein Blatt oder eine Spalte. */
@Component({
  selector: 'app-back-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './back-head.component.html',
  styleUrl: './back-head.component.scss',
})
export class BackHeadComponent {
  readonly title = input.required<string>();

  readonly backClick = output();
}
