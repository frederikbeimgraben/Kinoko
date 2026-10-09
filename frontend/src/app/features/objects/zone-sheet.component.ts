import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import type { Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { ViewportService } from '../../core/layout/viewport.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { MapAppLinkComponent } from '../../ui/map-app-link/map-app-link.component';
import { ObjectTitleComponent } from '../../ui/object-title/object-title.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SectionComponent } from '../../ui/section/section.component';
import { ToastService } from '../../ui/toast/toast.service';
import { visibilityText } from '../add-entry/visibility';
import { EntriesStore } from '../entries/entries.store';
import { NO_FILTER, inPolygon } from '../entries/entry-filter';
import { hectaresText } from '../entries/formats';
import { ObjectSheetStore } from './object-sheet.store';
import { colourHex } from '../entries/colors';
import { areaHa, asPolygon } from '../add-entry/area';
import { ObjectFormComponent, type ObjectValues } from '../add-entry/object-form.component';
import { ZONE_DRAWER, type DrawSession } from '../add-entry/zone-drawer';
import { Router } from '@angular/router';
import type { Location } from '../add-entry/add-entry.store';

/** The object sheet of a zone. "Change outline" gives the corners to Terra Draw. */
@Component({
  selector: 'app-zone-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ConfirmDialogComponent,
    ListRowComponent,
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
  private readonly router = inject(Router);

  readonly zone = input.required<Zone>();

  readonly closed = output();

  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);
  protected readonly editing = this.sheet.editing;
  protected readonly editingCorners = this.sheet.editingCorners;
  private readonly newCorners = signal<readonly Location[] | null>(null);
  /** The form values while the corners move. The form shows them again after the corner step. */
  private readonly draft = signal<ObjectValues | null>(null);
  private session: DrawSession | null = null;

  protected readonly start = computed<ObjectValues>(() => {
    const zone = this.zone();
    return (
      this.draft() ?? {
        name: zone.name,
        colour: zone.colour,
        note: zone.note,
        visibility: zone.visibility,
        groupId: zone.groupId,
      }
    );
  });

  /** The area of the form: from the new outline, if there is one. */
  protected readonly area = computed(() => {
    const outline = this.sheet.outline();
    return outline === null ? this.zone().areaHa : areaHa(outline);
  });

  /** The centre of the area: the point for a navigation app. */
  protected readonly center = computed<readonly [number, number]>(() => {
    const ring = this.zone().polygon.coordinates[0];
    const sum = ring.reduce((links, point) => [links[0] + point[0], links[1] + point[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  });

  protected readonly colour = computed(() => colourHex(this.zone().colour));

  /** The own finds inside the outline, per `ZoneViewBody.dc.html`. */
  protected readonly findCount = computed(() => {
    const polygon = this.zone().polygon;
    return String(this.eintraege.finds().filter((find) => inPolygon(find.lon, find.lat, polygon)).length);
  });

  /** The muted line below the name, per `ZoneViewBody.dc.html`. */
  protected readonly sub = computed(() =>
    this.i18n.translate('zone.unter', {
      flaeche: hectaresText(this.zone().areaHa, this.i18n.locale()),
      sichtbarkeit: visibilityText(this.i18n, this.zone().visibility),
    }),
  );

  constructor() {
    // A closed form drops its values. The store drops the outline.
    effect(() => {
      if (this.editing() || this.editingCorners()) return;
      untracked(() => {
        this.draft.set(null);
      });
    });
  }

  ngOnDestroy(): void {
    this.stopSession();
    if (this.editingCorners()) this.sheet.setEditing(false);
  }

  protected async save(values: ObjectValues): Promise<void> {
    this.busy.set(true);
    try {
      const outline = this.sheet.outline();
      const update = outline === null ? values : { ...values, polygon: outline };
      if (await this.eintraege.updateZone(this.zone(), update)) {
        this.toasts.success(this.i18n.translate('zone.gespeichert'));
        this.sheet.setEditing(false);
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Gives the corners to Terra Draw, in the colour of the form. The form values wait in `draft`. */
  protected async editCorners(values: ObjectValues): Promise<void> {
    const map = this.adapter.rawMap();
    if (map === null) return;
    this.draft.set(values);
    this.sheet.startCorners();
    this.session = await this.draw(map, colourHex(values.colour));
    const ring = (this.sheet.outline() ?? this.zone().polygon).coordinates[0]
      .slice(0, -1)
      .map((point) => [point[0], point[1]] as Location);
    this.session.showRing(ring);
    this.session.edit((next) => {
      this.newCorners.set(next);
    });
  }

  /** The status of the corner step for screen readers: the corners and the area. */
  readonly cornerNote = computed(() => {
    const moved = asPolygon(this.newCorners() ?? []);
    const ring = (moved ?? this.sheet.outline() ?? this.zone().polygon).coordinates[0];
    return this.i18n.translate('entry.zone.drawStatus', {
      points: ring.length - 1,
      area: hectaresText(moved === null ? this.area() : areaHa(moved), this.i18n.locale()),
    });
  });

  /** Keeps the new outline and goes back to the form, per `MapZoneEdit`. */
  applyCorners(): void {
    const corners = this.newCorners();
    this.stopSession();
    this.sheet.endCorners(corners === null ? null : asPolygon(corners));
  }

  cancelCorners(): void {
    this.stopSession();
    this.sheet.endCorners(null);
  }

  // The sheet closes before the request: the delete removes the zone from the list at once.
  protected async remove(): Promise<void> {
    const id = this.zone().id;
    this.deleteAsk.set(false);
    this.closed.emit();
    if (await this.eintraege.deleteZone(id)) this.toasts.success(this.i18n.translate('entry.zone.deleted'));
  }

  /** Opens the entries with the filter of this zone, per `EntriesZone.dc.html`.
   * A `history.back()` of the sheet would stop the navigation, so the list takes the history entry of the sheet. */
  protected showFinds(): void {
    this.eintraege.setFilter({ ...NO_FILTER, zoneId: this.zone().id });
    this.sheet.leave();
    void this.router.navigate(['/eintraege'], { replaceUrl: true });
  }

  private stopSession(): void {
    this.session?.stop();
    this.session = null;
    this.newCorners.set(null);
  }
}
