import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import type { Find, GeoPolygon, Marker, Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ThemeStore } from '../../core/theme/theme.store';
import { darkGround } from '../../map/background';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { CrosshairComponent } from '../../ui/crosshair/crosshair.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { StepBarComponent, type StepAction } from '../../ui/step-bar/step-bar.component';
import { panBelow } from '../add-entry/crosshair-aim';
import { EntriesStore } from '../entries/entries.store';
import { SheetHeightDirective } from '../map/sheet-height.directive';
import { MapStore, type ObjectKind } from '../map/map.store';
import { MapSurface } from '../map/map-surface';
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

/** The free edge around a zone outline, in pixels. The sides keep the corners clear of the map buttons. */
const ZONE_PADDING = { top: 48, bottom: 48, left: 88, right: 88 };

/** In the corner step, the step bar is over the map. The desktop map has no padding for it. */
const CORNER_PADDING = { ...ZONE_PADDING, bottom: 112 };

/** The padding of the map eases in 220 ms (`MapLibreAdapter.setPadding`). */
const PADDING_SETTLE_MS = 260;

/** The sheet over the map that shows a find, a marker or a zone. */
@Component({
  selector: 'app-object-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CrosshairComponent,
    FindSheetComponent,
    MarkerSheetComponent,
    OverlayHostComponent,
    SheetComponent,
    SheetHeightDirective,
    StepBarComponent,
    TranslatePipe,
    ZoneSheetComponent,
  ],
  templateUrl: './object-sheet.component.html',
  styleUrl: './object-sheet.component.scss',
})
export class ObjectSheetComponent {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly surface = inject(MapSurface);
  private readonly eintraege = inject(EntriesStore);
  private readonly i18n = inject(I18nService);
  private readonly sheet = inject(ObjectSheetStore);

  protected readonly map = inject(MapStore);
  private readonly theme = inject(ThemeStore);
  /** The crosshair gets a light halo on a dark base map. */
  protected readonly darkGround = computed(() => darkGround(this.map.background(), this.theme.effective()));

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

  /** The point of an open find or marker. */
  protected readonly location = computed<readonly [number, number] | null>(() => {
    const find = this.find();
    if (find) return [find.lon, find.lat];
    const marker = this.marker();
    return marker ? [marker.lon, marker.lat] : null;
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
  /** While the finger moves zone corners, the map stays bright and takes each tap. */
  protected readonly editingCorners = this.sheet.editingCorners;
  /** The crosshair looks for a new location of the marker or the find (boards `MarkerLocation`, `FindLocation`). */
  protected readonly relocating = this.sheet.relocating;

  private readonly cross = viewChild<ElementRef<HTMLElement>>('cross');
  protected readonly zoneSheet = viewChild<ZoneSheetComponent>('zoneSheet');

  protected readonly aimTitle = computed(() =>
    this.i18n.translate(this.marker() ? 'entry.setMarker.title' : 'entry.setLocation.title'),
  );

  /** Cancel and confirm, per `StepBar.dc.html`. */
  protected readonly aimActions = computed<readonly StepAction[]>(() => [
    {
      label: this.i18n.translate('common.cancel'),
      icon: 'close',
      variant: 'secondary',
      run: () => {
        this.sheet.cancelRelocating();
      },
    },
    {
      label: this.i18n.translate('entry.confirmLocation'),
      icon: 'check',
      variant: 'primary',
      run: () => {
        this.adoptAim();
      },
    },
  ]);

  /** The corner step of a zone has a step bar like "Zone zeichnen", not the sheet (`ZoneDraw.dc.html`). */
  protected readonly cornerActions = computed<readonly StepAction[]>(() => [
    {
      label: this.i18n.translate('common.cancel'),
      icon: 'close',
      variant: 'secondary',
      run: () => {
        this.zoneSheet()?.cancelCorners();
      },
    },
    {
      label: this.i18n.translate('common.apply'),
      icon: 'check',
      variant: 'primary',
      run: () => {
        this.zoneSheet()?.applyCorners();
      },
    },
  ]);

  constructor() {
    // A tap on an object or on an entry row moves the map to it. The move waits for the start of the map
    // and for the sheet height, because a padding change of the map stops a running move.
    effect((onCleanup) => {
      const point = this.location();
      this.map.overlayHeight();
      if (point === null || !this.surface.ready() || this.relocating()) return;
      const timer = setTimeout(() => {
        this.adapter.flyTo(point, ZOOM_OBJECT);
      }, PADDING_SETTLE_MS);
      onCleanup(() => {
        clearTimeout(timer);
      });
    });
    // The fit waits for the sheet height: the padding change of the map would stop a running fit.
    // The corner step has only the step bar, so the outline then fills the map.
    effect((onCleanup) => {
      const zone = this.zone();
      const outline = this.sheet.outline();
      const corners = this.editingCorners();
      this.map.overlayHeight();
      if (zone === null || !this.surface.ready()) return;
      const timer = setTimeout(() => {
        this.fitZone(outline ?? zone.polygon, corners ? CORNER_PADDING : ZONE_PADDING);
      }, PADDING_SETTLE_MS);
      onCleanup(() => {
        clearTimeout(timer);
      });
    });
    // The crosshair starts on the object. It is in the DOM only after the render.
    afterRenderEffect(() => {
      const cross = this.cross()?.nativeElement;
      if (this.relocating() && cross !== undefined) this.aimAtObject(cross);
    });
  }

  /** A zone shows its full outline, so "Umriss ändern" has each corner on the screen. */
  private fitZone(polygon: GeoPolygon, padding: typeof ZONE_PADDING): void {
    const ring = polygon.coordinates[0];
    const lons = ring.map((point) => point[0]);
    const lats = ring.map((point) => point[1]);
    this.adapter.rawMap()?.fitBounds(
      [
        [Math.min(...lons), Math.min(...lats)],
        [Math.max(...lons), Math.max(...lats)],
      ],
      { padding, maxZoom: ZOOM_OBJECT, duration: 400 },
    );
  }

  /** Moves the map so that the point of the form is below the crosshair. */
  private aimAtObject(cross: HTMLElement): void {
    const map = this.adapter.rawMap();
    const point = this.sheet.moved() ?? this.location();
    if (map !== null && point !== null) panBelow(map, cross, point);
  }

  private adoptAim(): void {
    const box = this.cross()?.nativeElement.getBoundingClientRect();
    const point =
      box === undefined ? null : this.adapter.pointAt(box.left + box.width / 2, box.top + box.height / 2);
    if (point === null) {
      this.sheet.cancelRelocating();
      return;
    }
    this.sheet.relocate([point[0], point[1]]);
  }

  /** Escape and a tap outside the sheet end the crosshair step or the corner step first. */
  protected hostClosed(): void {
    if (this.relocating()) this.sheet.cancelRelocating();
    else if (this.editingCorners()) this.zoneSheet()?.cancelCorners();
    else this.close();
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
