import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
// This file loads at the start. It imports each block alone and not through `ui/index.ts`:
// the barrel pulls each block into the first bundle.
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';

/**
 * Asks for the sign-in when something is to be saved, as a stacked dialog (board `MapSignIn`).
 * It shows only on {@link AuthService.requestSignIn}: map, species and layers stay usable without an account.
 */
@Component({
  selector: 'app-signin-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, TranslatePipe],
  templateUrl: './signin-sheet.component.html',
})
export class SignInSheetComponent {
  private readonly auth = inject(AuthService);

  protected readonly pending = this.auth.sheetOpen;
  protected readonly wide = inject(ViewportService).wide;

  protected signIn(): void {
    void this.auth.signIn();
  }

  protected later(): void {
    this.auth.later();
  }
}
