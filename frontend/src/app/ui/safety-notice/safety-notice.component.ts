import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** The safety notice of the catalogue: the app is no aid to eat a mushroom. No mockup has it,
 * so it takes the kit `.note` surface with the size of a sub-line. */
@Component({
  selector: 'app-safety-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './safety-notice.component.html',
  styleUrl: './safety-notice.component.scss',
})
export class SafetyNoticeComponent {}
