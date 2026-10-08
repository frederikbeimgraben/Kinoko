import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import type { Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { AddEntryStore } from '../add-entry/add-entry.store';
import { EntriesState } from '../entries/entries.state';
import { hectaresText } from '../entries/formats';
import { OfflineAreasStore } from './offline-areas.store';
import { sizeText } from './sizes';

/** One zone that can go on the device. */
interface Row {
  readonly zone: Zone;
  readonly sub: string;
}

/** The choice of a zone for the device, per `AreaPicker.dc.html`. */
@Component({
  selector: 'app-area-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FloatingButtonComponent,
    IconButtonComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './area-picker.component.html',
  styleUrl: './account-area-page.scss',
})
export class AreaPickerComponent {
  private readonly addEntry = inject(AddEntryStore);
  private readonly entries = inject(EntriesState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(OfflineAreasStore);

  /** The zones are not known while the first answer is pending and nothing is on the device. */
  protected readonly loading = computed(() => this.entries.loading() && this.entries.zones().length === 0);
  protected readonly busy = computed(() => this.store.loading() !== null);

  protected readonly rows = computed<readonly Row[]>(() =>
    this.entries
      .zones()
      .filter((zone) => !this.store.holds(zone.id))
      .map((zone) => ({
        zone,
        sub: joined([
          this.i18n.translate('area.hectares', { area: hectaresText(zone.areaHa, this.i18n.locale()) }),
          sizeText(this.store.estimate(zone), this.i18n.locale()),
        ]),
      })),
  );

  constructor() {
    this.store.prepare();
    this.entries.loadOnSignIn(this.entries.signedIn);
  }

  protected async download(zone: Zone): Promise<void> {
    const done = this.store.add(zone);
    void this.router.navigateByUrl('/konto/offline');
    await done;
  }

  /** A new zone is drawn on the map. */
  protected async draw(): Promise<void> {
    await this.router.navigateByUrl('/karte');
    this.addEntry.open();
  }

  protected toAreas(): void {
    void this.router.navigateByUrl('/konto/offline');
  }
}
