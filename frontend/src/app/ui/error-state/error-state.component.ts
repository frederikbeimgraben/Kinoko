import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Fehlerzustand beim Laden: Bild, Satz, dann „Erneut versuchen“. */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './error-state.component.html',
  styleUrl: './error-state.component.scss',
})
export class ErrorStateComponent {
  readonly text = input.required<string>();
  readonly icon = input<IconName>('warning');

  readonly retry = output();
}
