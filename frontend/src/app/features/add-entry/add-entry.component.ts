import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ButtonComponent, ToastService } from '@stupa-makers/ui-kit';
import type { MarkerColour } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { CrosshairComponent } from '../../ui/crosshair/crosshair.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { PopoverComponent, type PopoverAnchor } from '../../ui/popover/popover.component';
import { SheetComponent, type DetentSize } from '../../ui/sheet/sheet.component';
import { EntriesState, type SaveResult } from '../entries/entries.state';
import { colourHex } from '../entries/colors';
import { hectaresText } from '../entries/formats';
import { SheetHeightDirective } from '../map/sheet-height.directive';
import { MapState } from '../map/map.state';
import { AddActionsComponent, type AddAction } from './add-actions.component';
import { AddEntryState, type Location } from './add-entry.state';
import { coordinatesText } from './coordinates';
import { FindFormComponent, type FindSubmission } from './find-form.component';
import { asPolygon, loadAreaCalculator, type AreaCalculator } from './area';
import { ObjectFormComponent, type ObjectValues } from './object-form.component';
import { ZONE_DRAWER, type DrawSession } from './zone-drawer';

/** Ein kurzes Blatt folgt seinem Inhalt, ein Formular füllt seinen Wirt. */
const DETENTS_CONTENT: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];
const DETENTS_FORM: readonly [DetentSize, DetentSize, DetentSize] = [1, 1, 1];

/** Die Karte des Eintragens hängt am Plus-Knopf unten rechts. */
const POPOVER_ANCHOR: PopoverAnchor = { bottom: 92, end: 24 };

/** Der Kopf des Modals am Rechner nennt, worum es geht. */
const TITLE: Record<string, TranslationKey> = {
  actions: 'entry.create',
  findLocation: 'entry.setLocation.title',
  findForm: 'entry.reportFind.title',
  markerLocation: 'entry.setMarker.title',
  markerForm: 'entry.setMarker.title',
  zoneDraw: 'entry.drawZone.title',
  zoneForm: 'entry.zone.saveTitle',
};

/** Der Ablauf hinter dem Plus-Knopf: am Telefon ein Blatt, am Rechner ein Modal. */
@Component({
  selector: 'app-add-entry',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    AddActionsComponent,
    ButtonComponent,
    CrosshairComponent,
    FindFormComponent,
    NgTemplateOutlet,
    ObjectFormComponent,
    OverlayHostComponent,
    PopoverComponent,
    SheetComponent,
    SheetHeightDirective,
    TranslatePipe,
  ],
  templateUrl: './add-entry.component.html',
  styleUrl: './add-entry.component.scss',
})
export class AddEntryComponent implements OnDestroy {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly entries = inject(EntriesState);
  private readonly map = inject(MapState);
  private readonly draw = inject(ZONE_DRAWER);

  protected readonly state = inject(AddEntryState);
  protected readonly wide = inject(ViewportService).wide;
  /** Der untere Rand des freien Streifens: dort steht das Fadenkreuz. */
  protected readonly overlayHeight = this.map.overlayHeight;
  protected readonly anchor = POPOVER_ANCHOR;

  private readonly area = signal<AreaCalculator | null>(null);
  private session: DrawSession | null = null;
  private sessionRunning: Promise<DrawSession | null> | null = null;

  protected readonly saving = signal(false);
  /** Die Farbe, in der die Zone gerade gezeichnet wird. */
  protected readonly zoneColor = signal<MarkerColour>('green');

  /** Die Aktionen hängen am Rechner am Knopf, jeder andere Schritt im Modal. */
  protected readonly asPopover = computed(() => this.wide() && this.state.onActions());

  protected readonly detents = computed(() => (this.state.onForm() ? DETENTS_FORM : DETENTS_CONTENT));

  protected readonly title = computed(() => {
    const step = this.state.step();
    return step === null ? '' : this.i18n.translate(TITLE[step]);
  });

  protected readonly coordinates = computed(() =>
    this.state.onForm() ? coordinatesText(this.state.location(), this.i18n) : '',
  );

  protected readonly hectares = computed(() => {
    const compute = this.area();
    const polygon = asPolygon(this.state.ring());
    return compute !== null && polygon !== null ? compute(polygon) : 0;
  });

  protected readonly drawStatus = computed(() =>
    this.i18n.translate('entry.zone.drawStatus', {
      points: this.state.ring().length,
      area: hectaresText(this.hectares(), this.i18n.locale()),
    }),
  );

  constructor() {
    // Terra Draw und Turf kommen erst, wenn eine Zone entsteht. Beide liegen in
    // eigenen Paketen und fehlen dem Erstpaket.
    effect(() => {
      const step = this.state.step();
      if (step !== 'zoneDraw' && step !== 'zoneForm') {
        this.stopSession();
        return;
      }
      void this.prepareZone();
    });

    effect(() => {
      const ring = this.state.ring();
      this.session?.showRing(ring);
    });
  }

  ngOnDestroy(): void {
    this.stopSession();
  }

  protected start(action: AddAction): void {
    if (action === 'find') this.state.startFind();
    else if (action === 'marker') this.state.startMarker();
    else this.state.startZone();
  }

  protected cancel(): void {
    this.state.stop();
  }

  /** Übernimmt den Ort unter dem Fadenkreuz. */
  protected adoptLocation(): void {
    const location = this.center();
    if (location === null) return;
    this.state.adoptLocation(location);
  }

  protected addCorner(): void {
    const location = this.center();
    if (location === null) return;
    this.state.addCorner(location);
  }

  protected closeZone(): void {
    if (!this.state.closeZone()) this.toasts.error(this.i18n.translate('zone.zuWenigPunkte'));
  }

  protected async saveFind(submission: FindSubmission): Promise<void> {
    this.saving.set(true);
    try {
      this.report(await this.entries.saveFind(submission.input, submission.photos), 'melden');
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveMarker(values: ObjectValues): Promise<void> {
    const location = this.state.location();
    if (location === null) return;
    this.saving.set(true);
    try {
      const result = await this.entries.saveMarker({ ...values, lat: location[1], lon: location[0] });
      this.report(result, 'marker');
    } finally {
      this.saving.set(false);
    }
  }

  protected async saveZone(values: ObjectValues): Promise<void> {
    const polygon = asPolygon(this.state.ring());
    if (polygon === null) return;
    this.saving.set(true);
    try {
      const result = await this.entries.saveZone({ ...values, polygon });
      this.report(result, 'zone');
    } finally {
      this.saving.set(false);
    }
  }

  /** Die Vorschau auf der Karte folgt der gewählten Farbe. */
  protected onZoneValues(values: ObjectValues): void {
    this.zoneColor.set(values.colour);
  }

  private report(result: SaveResult, range: 'melden' | 'marker' | 'zone'): void {
    if (result === 'verworfen') {
      this.toasts.error(this.i18n.translate('melden.verworfen'));
      return;
    }
    this.toasts.success(this.i18n.translate(`${range}.${result}`));
    this.state.stop();
  }

  private center(): Location | null {
    const location = this.adapter.center();
    if (location === null) this.toasts.error(this.i18n.translate('entry.locationMissing'));
    return location;
  }

  /** Holt Turf und Terra Draw und legt den Ring auf die Karte. */
  private async prepareZone(): Promise<void> {
    this.area.set(await loadAreaCalculator());
    const map = this.adapter.rawMap();
    if (map === null || this.sessionRunning !== null) return;
    this.sessionRunning = this.draw(map, colourHex(this.zoneColor()));
    this.session = await this.sessionRunning;
    this.session?.showRing(this.state.ring());
  }

  private stopSession(): void {
    this.session?.stop();
    this.session = null;
    this.sessionRunning = null;
    this.map.overlayHeight.set(0);
  }
}
