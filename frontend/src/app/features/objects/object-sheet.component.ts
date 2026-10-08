import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import type { Find, Marker, Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { EntriesState } from '../entries/entries.state';
import { SheetHeightDirective } from '../map/sheet-height.directive';
import { MapStore, type ObjectKind } from '../map/map.store';
import { FindSheetComponent } from './find-sheet.component';
import { MarkerSheetComponent } from './marker-sheet.component';
import { ObjectSheetStore } from './object-sheet.store';
import { ZoneSheetComponent } from './zone-sheet.component';

/** The name of the sheet for assistive technology. */
const SHEET_NAME: Record<ObjectKind, TranslationKey> = {
  find: 'fund.blatt',
  marker: 'marker.blatt',
  zone: 'zone.blatt',
};

/** The title of the form for each kind (boards `MarkerEdit`, `ZoneEdit`, `FindEdit`). */
const EDIT_TITLE: Record<ObjectKind, TranslationKey> = {
  find: 'entry.fund.editTitle',
  marker: 'entry.marker.editTitle',
  zone: 'entry.zone.editTitle',
};

/** The zoom of an open object: near enough to see the way, far enough to see where you are. */
const ZOOM_OBJECT = 14;

/** The sheet over the map that shows a find, a marker or a zone. */
@Component({
  selector: 'app-object-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FindSheetComponent,
    MarkerSheetComponent,
    OverlayHostComponent,
    SheetComponent,
    SheetHeightDirective,
    TranslatePipe,
    ZoneSheetComponent,
  ],
  templateUrl: './object-sheet.component.html',
  styleUrl: './object-sheet.component.scss',
})
export class ObjectSheetComponent {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly eintraege = inject(EntriesState);
  private readonly i18n = inject(I18nService);
  private readonly sheet = inject(ObjectSheetStore);

  protected readonly map = inject(MapStore);

  protected readonly find = computed<Find | null>(() => {
    const offen = this.map.object();
    if (offen?.kind !== 'find') return null;
    return this.eintraege.finds().find((candidate) => candidate.id === offen.id) ?? null;
  });

  protected readonly marker = computed<Marker | null>(() => {
    const offen = this.map.object();
    if (offen?.kind !== 'marker') return null;
    return this.eintraege.markers().find((candidate) => candidate.id === offen.id) ?? null;
  });

  protected readonly zone = computed<Zone | null>(() => {
    const offen = this.map.object();
    if (offen?.kind !== 'zone') return null;
    return this.eintraege.zones().find((candidate) => candidate.id === offen.id) ?? null;
  });

  /** The point of the open object. For a zone, the centre of its corners. */
  protected readonly location = computed<readonly [number, number] | null>(() => {
    const find = this.find();
    if (find) return [find.lon, find.lat];
    const marker = this.marker();
    if (marker) return [marker.lon, marker.lat];
    const zone = this.zone();
    if (!zone) return null;
    const ring = zone.polygon.coordinates[0];
    const sum = ring.reduce((left, point) => [left[0] + point[0], left[1] + point[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  });

  /** The name of the sheet for assistive technology: find, marker or zone. */
  protected readonly sheetName = computed(() => {
    const offen = this.map.object();
    return offen === null ? '' : this.i18n.translate(SHEET_NAME[offen.kind]);
  });

  /** The title in the head: the kind of the object. The name is the `ObjectTitle` in the body. */
  protected readonly headTitle = computed(() => {
    const offen = this.map.object();
    if (offen === null) return '';
    if (this.editing()) return this.i18n.translate(EDIT_TITLE[offen.kind]);
    return this.sheetName();
  });

  /** Open, but not found: the entry is gone or belongs to another account. */
  protected readonly missing = computed(
    () => this.map.object() !== null && !this.find() && !this.marker() && !this.zone(),
  );

  protected readonly editing = this.sheet.editing;

  constructor() {
    // A tap on an object moves the map to it. The tap on the map and the tap on an entry row use this path.
    effect(() => {
      const point = this.location();
      if (point !== null) this.adapter.flyTo(point, ZOOM_OBJECT);
    });
  }

  protected close(): void {
    this.sheet.close();
  }

  /** The close button in the head: from the form back to the object, else close. */
  protected dismiss(): void {
    if (this.editing()) this.sheet.setEditing(false);
    else this.close();
  }
}
