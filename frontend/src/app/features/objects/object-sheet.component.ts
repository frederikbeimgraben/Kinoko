import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import type { Find, Marker, Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { SheetComponent, type DetentSize } from '../../ui/sheet/sheet.component';
import { coordinatesText } from '../add-entry/coordinates';
import { EntriesState } from '../entries/entries.state';
import { SheetHeightDirective } from '../map/sheet-height.directive';
import { MapState, type ObjectKind } from '../map/map.state';
import { FindSheetComponent } from './find-sheet.component';
import { MarkerSheetComponent } from './marker-sheet.component';
import { ObjectSheetState } from './object-sheet.state';
import { ZoneSheetComponent } from './zone-sheet.component';

/** Der Name des Blatts für Hilfsmittel. */
const SHEET_NAME: Record<ObjectKind, TranslationKey> = {
  find: 'fund.blatt',
  marker: 'marker.blatt',
  zone: 'zone.blatt',
};

/** Der Titel des Formulars je Art (Boards `MarkerEdit`, `ZoneEdit`, `FindEdit`). */
const EDIT_TITLE: Record<ObjectKind, TranslationKey> = {
  find: 'entry.fund.editTitle',
  marker: 'entry.marker.editTitle',
  zone: 'entry.zone.editTitle',
};

/** Die Höhe je Art steht so in den Boards `MarkerSheet`, `FindSheet` und `ZoneSheet`. */
const HEIGHT: Record<ObjectKind, DetentSize> = {
  find: '594px',
  marker: '444px',
  zone: '444px',
};

/** Die Höhe des Formulars aus den Boards `MarkerEdit`, `FindEdit` und `ZoneEdit`. */
const HEIGHT_EDIT: Record<ObjectKind, DetentSize> = {
  find: '694px',
  marker: '624px',
  zone: '734px',
};

/** Ein Objekt ohne Datensatz trägt nur seinen Hinweis. */
const HEIGHT_MISSING: DetentSize = 'content';

/**
 * So nah holt ein geöffnetes Objekt die Karte heran. Nah genug, um den Weg
 * dorthin zu sehen, weit genug, um zu wissen, wo man ist.
 */
const ZOOM_OBJECT = 14;

/** Das Blatt über der Karte, das einen Fund, einen Marker oder eine Zone zeigt. */
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
  private readonly sheet = inject(ObjectSheetState);

  protected readonly map = inject(MapState);

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

  /**
   * Der Punkt des offenen Objekts. Bei einer Zone der Mittelpunkt ihrer Ecken:
   * eine Fläche hat keinen einen Ort.
   */
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

  /** Der Name des Blatts für Hilfsmittel: Fund, Marker oder Zone. */
  protected readonly sheetName = computed(() => {
    const offen = this.map.object();
    return offen === null ? '' : this.i18n.translate(SHEET_NAME[offen.kind]);
  });

  /** Der Titel im Kopf: die Art des Objekts. Der Name steht als `ObjectTitle` im Rumpf. */
  protected readonly headTitle = computed(() => {
    const offen = this.map.object();
    if (offen === null) return '';
    if (this.editing()) return this.i18n.translate(EDIT_TITLE[offen.kind]);
    return this.sheetName();
  });

  /** Die gedämpfte Zeile unter dem Titel, nur im Formular. */
  protected readonly headNote = computed(() => {
    if (!this.editing()) return '';
    const find = this.find();
    return find === null ? '' : coordinatesText([find.lon, find.lat], this.i18n);
  });

  /** Offen, aber nichts gefunden: der Eintrag ist fort oder gehört einem anderen Konto. */
  protected readonly missing = computed(
    () => this.map.object() !== null && !this.find() && !this.marker() && !this.zone(),
  );

  protected readonly editing = this.sheet.editing;

  /** Das Formular des Fundes dunkelt die Karte ab, wie das Brett `FindEdit`. */
  protected readonly dark = computed(() => this.editing() && this.map.object()?.kind === 'find');

  protected readonly detents = computed<readonly [DetentSize, DetentSize, DetentSize]>(() => {
    const offen = this.map.object();
    if (offen === null || this.missing()) return [HEIGHT_MISSING, HEIGHT_MISSING, HEIGHT_MISSING];
    const size = this.editing() ? HEIGHT_EDIT[offen.kind] : HEIGHT[offen.kind];
    return [size, size, size];
  });

  constructor() {
    // Ein Tipp auf einen Marker soll ihn zeigen, nicht nur sein Blatt öffnen.
    // Der Weg über den Zustand fasst beide Wege zusammen: den Tipp auf der
    // Karte und den auf eine Zeile im Reiter Einträge.
    effect(() => {
      const point = this.location();
      if (point !== null) this.adapter.flyTo(point, ZOOM_OBJECT);
    });
  }

  protected close(): void {
    this.sheet.close();
  }

  /** Das X am Kopf: aus dem Formular zurück zum Objekt, sonst zu.  */
  protected dismiss(): void {
    if (this.editing()) this.editing.set(false);
    else this.close();
  }
}
