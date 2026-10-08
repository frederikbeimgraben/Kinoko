import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { AboutGroupComponent } from './about-group.component';

/** The page "About the app", per `AccountDesktopAbout.dc.html`. */
@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AboutGroupComponent, PageHeaderComponent, TranslatePipe],
  templateUrl: './about.component.html',
  styleUrl: './account-page.scss',
})
export class AboutComponent {
  private readonly router = inject(Router);
  private readonly wide = inject(ViewportService).wide;

  /** In the desktop detail pane the list is next to the page: no way back. */
  protected readonly back = computed(() => !this.wide());

  protected toAccount(): void {
    void this.router.navigateByUrl('/konto');
  }
}
