import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { IconButtonComponent } from '../icon-button/icon-button.component';

/** The signed-in account, per `kit.css` `.acct`. */
@Component({
  selector: 'app-account-tile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconButtonComponent, TranslatePipe],
  templateUrl: './account-tile.component.html',
  styleUrl: './account-tile.component.scss',
})
export class AccountTileComponent {
  readonly user = input.required<string>();
  readonly mail = input.required<string>();
  readonly server = input.required<string>();

  readonly signOut = output();

  protected readonly letter = computed(() => this.user().trim().charAt(0).toUpperCase());
}
