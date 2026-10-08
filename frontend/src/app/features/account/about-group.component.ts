import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PwaStore } from '../../core/pwa/pwa.store';
import { APP_VERSION } from '../../core/version.generated';
import { LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';

/** The group "About the app": method, sources and licences, version. */
@Component({
  selector: 'app-about-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelPillComponent, ListRowComponent, RowGroupComponent, TranslatePipe],
  templateUrl: './about-group.component.html',
})
export class AboutGroupComponent {
  private readonly router = inject(Router);

  protected readonly updateReady = inject(PwaStore).updateReady;
  protected readonly version = APP_VERSION;

  protected open(path: string): void {
    void this.router.navigateByUrl(path);
  }
}
