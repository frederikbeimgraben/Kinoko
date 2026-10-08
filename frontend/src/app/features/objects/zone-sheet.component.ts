import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { ViewportService } from '../../core/layout/viewport.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { MapAppLinkComponent } from '../../ui/map-app-link/map-app-link.component';
import { ObjectTitleComponent } from '../../ui/object-title/object-title.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SectionComponent } from '../../ui/section/section.component';
import { ToastService } from '../../ui/toast/toast.service';
import { visibilityText } from '../add-entry/visibility';
import { EntriesStore } from '../entries/entries.store';
import { hectaresText } from '../entries/formats';
import { ObjectSheetStore } from './object-sheet.store';
import { colourHex } from '../entries/colors';
import { asPolygon } from '../add-entry/area';
import { ObjectFormComponent, type ObjectValues } from '../add-entry/object-form.component';
import { ZONE_DRAWER, type DrawSession } from '../add-entry/zone-drawer';
import type { Location } from '../add-entry/add-entry.store';

/** The object sheet of a zone. "Change outline" gives the corners to Terra Draw. */
@Component({
  selector: 'app-zone-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    MapAppLinkComponent,
    ObjectFormComponent,
    ObjectTitleComponent,
    RowGroupComponent,
    ScrollFadeDirective,
    SectionComponent,
    TranslatePipe,
  ],
  templateUrl: './zone-sheet.component.html',
  styleUrl: './zone-sheet.component.scss',
})
export class ZoneSheetComponent implements OnDestroy {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly eintraege = inject(EntriesStore);
  protected readonly sheet = inject(ObjectSheetStore);
  protected readonly wide = inject(ViewportService).wide;
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly draw = inject(ZONE_DRAWER);

  readonly zone = input.required<Zone>();

  readonly closed = output();

  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);
  protected readonly editing = this.sheet.editing;
  protected readonly editingCorners = signal(false);
  private readonly newCorners = signal<readonly Location[] | null>(null);
  private session: DrawSession | null = null;

  protected readonly start = computed<ObjectValues>(() => {
    const zone = this.zone();
    return {
      name: zone.name,
      colour: zone.colour,
      note: zone.note,
      visibility: zone.visibility,
      groupId: zone.groupId,
    };
  });

  /** The centre of the area: the point for a navigation app. */
  protected readonly center = computed<readonly [number, number]>(() => {
    const ring = this.zone().polygon.coordinates[0];
    const sum = ring.reduce((links, point) => [links[0] + point[0], links[1] + point[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  });

  protected readonly colour = computed(() => colourHex(this.zone().colour));

  /** The muted line below the name, per `ZoneViewBody.dc.html`. */
  protected readonly sub = computed(() =>
    this.i18n.translate('zone.unter', {
      flaeche: hectaresText(this.zone().areaHa, this.i18n.locale()),
      sichtbarkeit: visibilityText(this.i18n, this.zone().visibility),
    }),
  );

  ngOnDestroy(): void {
    this.stopSession();
  }

  protected async save(values: ObjectValues): Promise<void> {
    this.busy.set(true);
    try {
      if (await this.eintraege.updateZone(this.zone(), values)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
        this.sheet.setEditing(false);
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Gives the corners to Terra Draw. The finger can then move them. */
  protected async editCorners(): Promise<void> {
    const map = this.adapter.rawMap();
    if (map === null) return;
    this.sheet.setEditing(false);
    this.editingCorners.set(true);
    this.session = await this.draw(map, colourHex(this.zone().colour));
    const ring = this.zone()
      .polygon.coordinates[0].slice(0, -1)
      .map((point) => [point[0], point[1]] as Location);
    this.session.showRing(ring);
    this.session.edit((next) => {
      this.newCorners.set(next);
    });
  }

  protected async applyCorners(): Promise<void> {
    const corners = this.newCorners();
    const polygon = corners === null ? null : asPolygon(corners);
    this.stopSession();
    if (polygon === null) return;
    if (await this.eintraege.updateZone(this.zone(), { polygon })) {
      this.toasts.success(this.i18n.translate('objekt.gespeichert'));
    }
  }

  protected cancelCorners(): void {
    this.stopSession();
  }

  protected async remove(): Promise<void> {
    this.deleteAsk.set(false);
    if (await this.eintraege.deleteZone(this.zone().id)) {
      this.toasts.success(this.i18n.translate('objekt.geloescht'));
      this.closed.emit();
    }
  }

  private stopSession(): void {
    this.session?.stop();
    this.session = null;
    this.newCorners.set(null);
    this.editingCorners.set(false);
  }
}
