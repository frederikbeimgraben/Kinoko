import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { AccountStatsComponent } from './account-stats.component';
import { AppearanceFieldsComponent } from './appearance-fields.component';
import { OfflineSectionComponent } from './offline-section.component';

/** The desktop detail "Appearance and language", per `AccountDesktop.dc.html`. */
@Component({
  selector: 'app-appearance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AccountStatsComponent,
    AppearanceFieldsComponent,
    OfflineSectionComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './appearance.component.html',
  styleUrl: './account-page.scss',
})
export class AppearanceComponent {
  protected readonly signedIn = inject(AuthService).signedIn;
}
