import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth';
import { ConfigStore } from '../../core/config/config.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
// This file loads at the start. It imports each block alone and not through `ui/index.ts`:
// the barrel pulls each block into the first bundle.
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { signInLabel } from './sign-in-label';

/** Asks for the sign-in before a save, as a stacked dialog (board `MapSignIn`). The map stays usable without it. */
@Component({
  selector: 'app-signin-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ConfirmDialogComponent, TranslatePipe],
  templateUrl: './signin-sheet.component.html',
})
export class SignInSheetComponent {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigStore);

  protected readonly pending = this.auth.sheetOpen;
  protected readonly signingIn = this.auth.signingIn;
  protected readonly signInLabel = signInLabel();
  protected readonly ssoMissing = this.config.ssoMissing;
  protected readonly wide = inject(ViewportService).wide;

  protected signIn(): void {
    void this.auth.signInFromSheet();
  }

  protected later(): void {
    this.auth.later();
  }
}
