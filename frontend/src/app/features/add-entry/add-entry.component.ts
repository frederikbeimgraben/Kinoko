import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import type { MarkerColour } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { CrosshairComponent } from '../../ui/crosshair/crosshair.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { PopoverComponent, type PopoverAnchor } from '../../ui/popover/popover.component';
import { SheetComponent, type DetentSize } from '../../ui/sheet/sheet.component';
import { ToastService } from '../../ui/toast/toast.service';
import { EntriesState, type SaveResult } from '../entries/entries.state';
import { colourHex } from '../entries/colors';
import { hectaresText } from '../entries/formats';
import { SheetHeightDirective } from '../map/sheet-height.directive';
import { MapState } from '../map/map.state';
import { AddActionsComponent, type AddAction } from './add-actions.component';
import { AddEntryState, CORNERS_MINIMUM, type Location } from './add-entry.state';
import { coordinatesText } from './coordinates';
import { FindFormComponent, type FindSubmission } from './find-form.component';
import { asPolygon, loadAreaCalculator, type AreaCalculator } from './area';
import { ObjectFormComponent, type ObjectValues } from './object-form.component';
import { StepBarComponent, type StepAction } from '../../ui/step-bar/step-bar.component';
import { StepInput } from './step-input';
import { paintRing, clearRing } from './step-painter';
import { ZONE_DRAWER, type DrawSession } from './zone-drawer';

/** Ein kurzes Blatt folgt seinem Inhalt, ein Formular füllt seinen Wirt. */
const DETENTS_CONTENT: readonly [DetentSize, DetentSize, DetentSize] = ['content', 'content', 'content'];
const DETENTS_FORM: readonly [DetentSize, DetentSize, DetentSize] = [1, 1, 1];

/** Der gesetzte Ort steht am Rechner blau, wie die Bretter ihn malen. */
const MARK_COLOUR = 'blue' as const;

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
    AddActionsComponent,
    CrosshairComponent,
    FindFormComponent,
    NgTemplateOutlet,
    ObjectFormComponent,
    OverlayHostComponent,
    PopoverComponent,
    SheetComponent,
    StepBarComponent,
    SheetHeightDirective,
    TranslatePipe,
  ],
  providers: [StepInput],
  templateUrl: './add-entry.component.html',
  styleUrl: './add-entry.component.scss',
})
export class AddEntryComponent implements OnDestroy {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly entries = inject(EntriesState);
  private readonly map = inject(MapState);
  private readonly draw = inject(ZONE_DRAWER);

  protected readonly state = inject(AddEntryState);
  protected readonly wide = inject(ViewportService).wide;
  protected readonly anchor = POPOVER_ANCHOR;

  private readonly area = signal<AreaCalculator | null>(null);
  private session: DrawSession | null = null;
  private sessionRunning: Promise<DrawSession | null> | null = null;

  protected readonly saving = signal(false);
  /** Die Farbe, in der die Zone gerade gezeichnet wird. */
  protected readonly zoneColor = signal<MarkerColour>('green');

  /** Die Aktionen hängen am Rechner am Knopf, jeder andere Schritt im Modal. */
  protected readonly asPopover = computed(() => this.wide() && this.state.onActions());

  /** Ein Schritt auf der Karte trägt die Leiste, kein Blatt. */
  protected readonly asStepBar = this.state.showsCrosshair;

  /** Die Knöpfe des Schritts, einmal beschrieben. Das X bricht ihn ab. */
  protected readonly barActions = computed<readonly StepAction[]>(() => {
    const cancel: StepAction = {
      label: this.i18n.translate('common.cancel'),
      icon: 'close',
      variant: 'secondary',
      run: () => {
        this.cancel();
      },
    };
    if (this.state.step() !== 'zoneDraw') {
      const marker = this.state.step() === 'markerLocation';
      return [
        {
          label: this.i18n.translate(marker ? 'entry.confirmMarker' : 'entry.confirmLocation'),
          icon: 'check',
          variant: 'primary',
          run: () => {
            this.adoptLocation();
          },
        },
        cancel,
      ];
    }
    return [
      {
        label: this.i18n.translate('entry.zone.setVertex'),
        icon: 'plus',
        variant: 'primary',
        run: () => {
          this.addCorner();
        },
      },
      {
        label: this.i18n.translate('entry.zone.removeLastVertex'),
        icon: 'undo',
        variant: 'secondary',
        run: () => {
          this.state.removeLastCorner();
        },
      },
      {
        label: this.i18n.translate('entry.zone.finish'),
        icon: 'check',
        variant: 'secondary',
        run: () => {
          this.closeZone();
        },
      },
      cancel,
    ];
  });

  /** Die Marke der Leiste: die Ecken der Zone oder der Ort. */
  protected readonly stepNote = computed(() =>
    this.state.step() === 'zoneDraw' ? this.drawStatus() : this.aimText(),
  );

  protected readonly detents = computed(() => (this.state.onForm() ? DETENTS_FORM : DETENTS_CONTENT));

  protected readonly title = computed(() => {
    const step = this.state.step();
    return step === null ? '' : this.i18n.translate(TITLE[step]);
  });

  /** Die Titelgröße je Schritt, wie die Bretter `AddActions`, `FindForm`, `MarkerForm` und `ZoneForm` sie zeigen. */
  protected readonly titleSize = computed(() => {
    const step = this.state.step();
    if (step === 'findForm') return 24;
    if (step === 'markerForm' || step === 'zoneForm') return 22;
    return 17;
  });

  /** Nur der Formtitel ist fett mit engerer Laufweite, der Aktionstitel bleibt halbfett. */
  protected readonly titleBold = computed(() => this.state.onForm());

  protected readonly coordinates = computed(() =>
    this.state.onForm() ? coordinatesText(this.state.location(), this.i18n) : '',
  );

  private readonly input = inject(StepInput);

  /** Der Ort, den der nächste Punkt bekäme: Fadenkreuz oder Zeiger. */
  private readonly aim = this.input.aim;

  protected readonly aimText = computed(() =>
    coordinatesText(this.state.location() ?? this.aim(), this.i18n),
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
    // Das Kreuz steht erst nach dem Zeichnen im Baum, und sein Ort ändert
    // sich mit jedem Schwenk.
    afterRenderEffect(() => {
      this.map.moved();
      this.state.step();
      this.input.aimAt(this.pointUnderCrosshair());
    });

    // Der Zeiger setzt am Rechner die Punkte. Er hört nur, solange ein
    // Schritt den Ort sucht.
    effect(() => {
      if (!this.state.showsCrosshair()) {
        this.input.stop();
        return;
      }
      this.input.watch(
        (point) => {
          this.onPick(point);
        },
        () => (this.state.step() === 'zoneDraw' ? null : this.state.location()),
      );
    });

    // Der gesetzte Ort und die Vorschau am Zeiger liegen auf der Karte.
    effect(() => {
      const map = this.adapter.rawMap();
      const step = this.state.step();
      if (map === null) return;
      if (step !== 'findLocation' && step !== 'markerLocation') return;
      paintRing(map, [], colourHex(MARK_COLOUR), { mark: this.state.location() });
    });

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
      this.session?.showRing(ring, { pointer: this.pointerAim() });
    });
  }

  ngOnDestroy(): void {
    this.input.stop();
    this.stopSession();
    this.state.abandon();
  }

  protected start(action: AddAction): void {
    if (action === 'find') this.state.startFind();
    else if (action === 'marker') this.state.startMarker();
    else this.state.startZone();
  }

  protected cancel(): void {
    this.state.stop();
  }

  /** Der Ort unter dem Zeiger, nur am Rechner: er hängt an der Vorschau-Kante. */
  private pointerAim(): Location | null {
    return this.input.mode() === 'pointer' ? this.aim() : null;
  }

  /** Ein Klick auf die Karte setzt eine Ecke oder den Ort. */
  private onPick(point: Location): void {
    if (this.state.step() !== 'zoneDraw') {
      this.state.setPoint(point);
      return;
    }
    const ring = this.state.ring();
    if (ring.length >= CORNERS_MINIMUM && this.input.hits(ring[0], point)) {
      this.closeZone();
      return;
    }
    this.state.addCorner(point);
  }

  /** Übernimmt den Ort unter dem Fadenkreuz oder unter dem Zeiger. */
  protected adoptLocation(): void {
    const location = this.state.location() ?? this.center();
    if (location === null) return;
    this.state.adoptLocation(location);
  }

  /** Am Rechner: Eingabe schließt, Rücktaste nimmt die letzte Ecke, Esc bricht ab. */
  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (!this.state.showsCrosshair() || this.input.mode() !== 'pointer') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.state.step() === 'zoneDraw') this.closeZone();
      else this.adoptLocation();
      return;
    }
    if (event.key === 'Backspace' && this.state.step() === 'zoneDraw') {
      event.preventDefault();
      this.state.removeLastCorner();
    }
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

  /** Der Ort unter dem Fadenkreuz, nicht der in der Mitte der Karte. */
  private center(): Location | null {
    const location = this.pointUnderCrosshair() ?? this.aim() ?? this.adapter.center();
    if (location === null) this.toasts.error(this.i18n.translate('entry.locationMissing'));
    return location;
  }

  private pointUnderCrosshair(): Location | null {
    const cross = this.host.nativeElement.querySelector('app-crosshair');
    if (cross === null) return null;
    const box = cross.getBoundingClientRect();
    const point = this.adapter.pointAt(box.left + box.width / 2, box.top + box.height / 2);
    return point === null ? null : [point[0], point[1]];
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
    const map = this.adapter.rawMap();
    if (map !== null) clearRing(map);
    this.session?.stop();
    this.session = null;
    this.sessionRunning = null;
    this.map.overlayHeight.set(0);
  }
}
