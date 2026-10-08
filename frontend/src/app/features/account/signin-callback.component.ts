import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ButtonComponent } from '../../ui/button/button.component';

/**
 * The SSO return page. It exchanges the code for tokens and goes back to the route where sign-in started.
 */
@Component({
  selector: 'app-signin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TranslatePipe],
  templateUrl: './signin-callback.component.html',
  styleUrl: './signin-callback.component.scss',
})
export class SignInCallbackComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly failure = signal(false);

  constructor() {
    void this.finish();
  }

  protected toMap(): void {
    void this.router.navigateByUrl('/karte');
  }

  private async finish(): Promise<void> {
    try {
      await this.router.navigateByUrl(await this.auth.completeSignIn());
    } catch {
      // An expired or reused code ends here. The page shows the error
      // and keeps the path back to the map open.
      this.failure.set(true);
    }
  }
}
