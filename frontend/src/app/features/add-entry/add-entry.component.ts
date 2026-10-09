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
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { ZONE_DEFAULT_COLOUR } from '../../ui/zone-shape/zone-shape.constants';
import { CrosshairComponent } from '../../ui/crosshair/crosshair.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { PopoverComponent, type PopoverAnchor } from '../../ui/popover/popover.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { ToastService } from '../../ui/toast/toast.service';
import { EntriesStore, type SaveResult } from '../entries/entries.store';
import { hectaresText } from '../entries/formats';
import { SheetHeightDirective } from '../map/sheet-height.directive';
import { MapStore } from '../map/map.store';
import { AddActionsComponent, type AddAction } from './add-actions.component';
import { AddEntryStore, CORNERS_MINIMUM, type Location } from './add-entry.store';
import { coordinatesText } from './coordinates';
import { FindFormComponent, type FindSubmission } from './find-form.component';
import type { FindDraft } from './find-draft';
import { areaHa, asPolygon } from './area';
import { ObjectFormComponent, type ObjectValues } from './object-form.component';
import { StepBarComponent, type StepAction } from '../../ui/step-bar/step-bar.component';
import { StepInput } from './step-input';
import { paintRing, clearRing } from './step-painter';
import { ZONE_DRAWER, type DrawSession } from './zone-drawer';

/** The set location is blue on the desktop, as on the boards. No object colour is blue. */
const MARK_COLOUR = '#185468';

/** Board `MapDesktopAdd`: the menu is at the bottom right of the map pane, where the plus button was. */
const POPOVER_ANCHOR: PopoverAnchor = { bottom: 24, end: 24 };

/** The head of the modal on the desktop gives the subject. */
const TITLE: Record<string, TranslationKey> = {
  actions: 'entry.create',
  findLocation: 'entry.setLocation.title',
  findForm: 'entry.reportFind.title',
  markerLocation: 'entry.setMarker.title',
  markerForm: 'entry.setMarker.title',
  zoneDraw: 'entry.drawZone.title',
  zoneForm: 'entry.zone.saveTitle',
};

/** The flow behind the add button: a sheet on the phone, a modal on the desktop. */
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
  private readonly entries = inject(EntriesStore);
  private readonly map = inject(MapStore);
  private readonly draw = inject(ZONE_DRAWER);

  protected readonly state = inject(AddEntryStore);
  protected readonly wide = inject(ViewportService).wide;
  protected readonly anchor = POPOVER_ANCHOR;

  private session: DrawSession | null = null;
  private sessionRunning: Promise<DrawSession | null> | null = null;

  protected readonly saving = signal(false);

  /** On the desktop, the actions hang at the button. Each other step is a modal. */
  protected readonly asPopover = computed(() => this.wide() && this.state.onActions());

  /** A step on the map has the step bar, not a sheet. */
  protected readonly asStepBar = this.state.showsCrosshair;

  /** The buttons of a step, per `StepBar.dc.html`. Undo removes the last corner or the set point. */
  protected readonly barActions = computed<readonly StepAction[]>(() => {
    const zone = this.state.step() === 'zoneDraw';
    const marker = this.state.step() === 'markerLocation';
    return [
      {
        label: this.i18n.translate('entry.zone.removeLastVertex'),
        icon: 'undo',
        variant: 'secondary',
        run: () => {
          if (zone) this.state.removeLastCorner();
          else this.state.clearPoint();
        },
      },
      {
        label: this.i18n.translate('common.cancel'),
        icon: 'close',
        variant: 'secondary',
        run: () => {
          this.cancel();
        },
      },
      {
        label: this.i18n.translate(
          zone ? 'entry.zone.finish' : marker ? 'entry.confirmMarker' : 'entry.confirmLocation',
        ),
        icon: 'check',
        variant: 'primary',
        run: () => {
          if (zone) this.closeZone();
          else this.adoptLocation();
        },
      },
    ];
  });

  /** A location step aims with the crosshair. A zone takes its corners from taps. */
  protected readonly showsCrosshair = computed(() => {
    const step = this.state.step();
    return step === 'findLocation' || step === 'markerLocation';
  });

  /** The status of the bar: the corners of the zone or the point. */
  protected readonly stepNote = computed(() =>
    this.state.step() === 'zoneDraw' ? this.drawStatus() : this.aimText(),
  );

  protected readonly title = computed(() => {
    const step = this.state.step();
    return step === null ? '' : this.i18n.translate(TITLE[step]);
  });

  private readonly input = inject(StepInput);

  /** The location of the next point: the crosshair or the pointer. */
  private readonly aim = this.input.aim;

  protected readonly aimText = computed(() =>
    coordinatesText(this.state.location() ?? this.aim(), this.i18n),
  );

  protected readonly hectares = computed(() => {
    const polygon = asPolygon(this.state.ring());
    return polygon === null ? 0 : areaHa(polygon);
  });

  protected readonly drawStatus = computed(() =>
    this.i18n.translate('entry.zone.drawStatus', {
      points: this.state.ring().length,
      area: hectaresText(this.hectares(), this.i18n.locale()),
    }),
  );

  constructor() {
    // The crosshair is in the DOM only after the render, and its location changes with each pan.
    afterRenderEffect(() => {
      this.map.moved();
      this.state.step();
      this.input.aimAt(this.pointUnderCrosshair());
    });

    // The pointer sets the points. It listens only while a step looks for a location.
    effect(() => {
      if (!this.state.showsCrosshair()) {
        this.input.stop();
        return;
      }
      const drawing = this.state.step() === 'zoneDraw';
      this.input.watch(
        (point) => {
          this.onPick(point);
        },
        () => (drawing ? null : this.state.location()),
        drawing,
      );
    });

    // The set location and the preview at the pointer are on the map.
    effect(() => {
      const map = this.adapter.rawMap();
      const step = this.state.step();
      if (map === null) return;
      if (step !== 'findLocation' && step !== 'markerLocation') return;
      paintRing(map, [], MARK_COLOUR, { mark: this.state.location() });
    });

    // Terra Draw loads only for a zone. It is a separate chunk, not in the first bundle.
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
      const pointer = this.pointerAim();
      const closing = pointer !== null && ring.length >= CORNERS_MINIMUM && this.input.hits(ring[0], pointer);
      this.session?.showRing(ring, { pointer, closing, wide: this.wide() });
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

  /** The location below the pointer, only on the desktop: the preview edge goes to it. */
  private pointerAim(): Location | null {
    return this.wide() ? this.aim() : null;
  }

  /** A click on the map sets a corner or the location. */
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

  // On the phone, the crosshair aims and only the undo clears a set point. A kept point would win over the crosshair.
  protected editLocation(draft: FindDraft): void {
    this.state.editFindLocation(draft, this.input.mode() === 'pointer');
  }

  /** Takes the location below the crosshair or below the pointer. */
  protected adoptLocation(): void {
    const location = this.state.location() ?? this.center();
    if (location === null) return;
    this.state.adoptLocation(location);
  }

  /** On the desktop: Enter closes, Backspace removes the last corner, Esc cancels. */
  @HostListener('document:keydown', ['$event'])
  protected onKey(event: KeyboardEvent): void {
    if (!this.state.showsCrosshair() || !this.wide()) return;
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

  // A refused body keeps the form open. The API client already showed the reason of the service.
  private report(result: SaveResult, range: 'melden' | 'marker' | 'zone'): void {
    if (result === 'abgelehnt') return;
    if (result === 'verworfen') {
      this.toasts.error(this.i18n.translate('melden.verworfen'));
      return;
    }
    this.toasts.success(this.i18n.translate(`${range}.${result}`));
    this.state.stop();
  }

  /** The location below the crosshair, not the centre of the map. */
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

  /** Loads Terra Draw and puts the ring on the map. */
  private async prepareZone(): Promise<void> {
    const map = this.adapter.rawMap();
    if (map === null || this.sessionRunning !== null) return;
    this.sessionRunning = this.draw(map, ZONE_DEFAULT_COLOUR);
    this.session = await this.sessionRunning;
    this.session?.showRing(this.state.ring(), { wide: this.wide() });
  }

  private stopSession(): void {
    const map = this.adapter.rawMap();
    if (map !== null) clearRing(map);
    this.session?.stop();
    this.session = null;
    this.sessionRunning = null;
    this.map.setOverlayHeight(0);
  }
}
