import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { LevelPillComponent } from '../level-pill/level-pill.component';

/** The head of a page, as in `TopBar.dc.html` and `DetailBar.dc.html`. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, LevelPillComponent, TranslatePipe],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  /** The page title. An empty string keeps the space of the title; `null` shows the `[headline]` slot. */
  readonly title = input<string | null>(null);
  readonly back = input(false);
  readonly close = input(false);
  /** The count next to the title, as on the entry list. */
  readonly count = input('');
  /** On the desktop a head without a lead button has a larger indent. */
  readonly wide = input(false);

  readonly backClick = output();
  readonly closeClick = output();

  protected readonly lead = computed(() => this.back() || this.close());
}
