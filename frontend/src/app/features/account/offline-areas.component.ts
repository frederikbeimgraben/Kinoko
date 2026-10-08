import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { hectaresText } from '../entries/formats';
import { OfflineAreasStore } from './offline-areas.store';
import { sizeText } from './sizes';

/** One area row. */
interface Row {
  readonly id: string;
  readonly name: string;
  readonly sub: string;
}

/** The offline areas, per `OfflineAreas.dc.html`: the zones on the device and their size. */
@Component({
  selector: 'app-offline-areas',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FloatingButtonComponent,
    IconButtonComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './offline-areas.component.html',
  styleUrl: './account-area-page.scss',
})
export class OfflineAreasComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(OfflineAreasStore);
  private readonly wide = inject(ViewportService).wide;

  protected readonly back = computed(() => !this.wide());
  protected readonly loading = this.store.loading;

  protected readonly rows = computed<readonly Row[]>(() =>
    this.store.areas().map((area) => ({
      id: area.id,
      name: area.name,
      sub: joined([
        this.i18n.translate('area.hectares', { area: hectaresText(area.areaHa, this.i18n.locale()) }),
        sizeText(area.bytes, this.i18n.locale()),
      ]),
    })),
  );

  protected remove(id: string): void {
    void this.store.remove(id);
  }

  protected pick(): void {
    void this.router.navigateByUrl('/konto/offline/zonen');
  }

  protected toAccount(): void {
    void this.router.navigateByUrl('/konto');
  }
}
