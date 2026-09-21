import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconButtonComponent } from '../icon-button/icon-button.component';
import { LevelPillComponent } from '../level-pill/level-pill.component';

/** Der Kopf einer Seite, per `TopBar.dc.html` und `DetailBar.dc.html`. */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, LevelPillComponent, TranslatePipe],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  readonly title = input('');
  readonly back = input(false);
  readonly close = input(false);
  /** Die Zahl neben dem Titel, wie die Liste der Einträge sie trägt. */
  readonly count = input('');
  /** Am Rechner rückt ein Kopf ohne Zeichen weiter ein. */
  readonly wide = input(false);

  readonly backClick = output();
  readonly closeClick = output();

  protected readonly lead = computed(() => this.back() || this.close());
}
