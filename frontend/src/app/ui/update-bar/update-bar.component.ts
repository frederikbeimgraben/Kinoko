import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ButtonComponent } from '@stupa-makers/ui-kit';
import { PwaService } from '../../core/pwa/pwa.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/**
 * Die Leiste am Kopf jeder Seite, sobald eine neue Fassung bereitsteht.
 */
@Component({
  selector: 'app-update-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, TranslatePipe],
  templateUrl: './update-bar.component.html',
  styleUrl: './update-bar.component.scss',
})
export class UpdateBarComponent {
  private readonly pwa = inject(PwaService);

  protected readonly ready = this.pwa.updateReady;

  protected reload(): void {
    void this.pwa.activate();
  }
}
