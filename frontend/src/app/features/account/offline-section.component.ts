import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SyncStore } from '../../core/offline/sync.store';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { OfflineAreasStore } from './offline-areas.store';
import { sizeText } from './sizes';

/** The section "Offline": the size of the offline areas and the number of pending transfers. */
@Component({
  selector: 'app-offline-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, RowGroupComponent, SectionComponent, TranslatePipe],
  templateUrl: './offline-section.component.html',
})
export class OfflineSectionComponent {
  private readonly areas = inject(OfflineAreasStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly sync = inject(SyncStore);

  protected readonly size = computed(() => sizeText(this.areas.totalBytes(), this.i18n.locale()));
  protected readonly pending = computed(() => String(this.sync.pendingCount()));

  protected toAreas(): void {
    void this.router.navigateByUrl('/konto/offline');
  }
}
