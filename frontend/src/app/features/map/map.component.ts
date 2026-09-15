import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { LocationService } from '../../core/location/location.service';
import { SyncService } from '../../core/offline/sync.service';
import { TileService } from '../../core/tiles/tile.service';
import type { Layer } from '../../core/tiles/layers';
import { VisibilityService } from '../../core/visibility/visibility.service';
import { MAP_PROVIDERS } from '../../map/map.tokens';
import { BannerComponent } from '../../ui/banner/banner.component';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';
import { ObjectMenuComponent, type ObjectMenuTarget } from '../../ui/object-menu/object-menu.component';
import { SheetComponent, type Detent } from '../../ui/sheet/sheet.component';
import { SkeletonComponent } from '../../ui/skeleton/skeleton.component';
import { AddEntryComponent } from '../add-entry/add-entry.component';
import { AddEntryState } from '../add-entry/add-entry.state';
import { EntriesState } from '../entries/entries.state';
import { MapObjectsDirective } from '../objects/map-objects.directive';
import { ObjectSheetComponent } from '../objects/object-sheet.component';
import { CombinationState } from './combination.state';
import { LayersSheetComponent } from './layers-sheet.component';
import { MapColumnComponent } from './map-column.component';
import { MapHeadComponent } from './map-head.component';
import { MapPanelComponent } from './map-panel.component';
import { MapOverlaysComponent, overlayDetent, type Overlay } from './map-overlays.component';
import { MapPlayback } from './map-playback';
import { DETENTS, DETENT_SIZES, MapSurface } from './map-surface';
import { MapState } from './map.state';
import { MapView } from './map.view';
import type { Factor } from './factors';

/** Der Reiter Karte: Hintergrund, Wertkacheln und das Blatt darüber. */
@Component({
  selector: 'app-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddEntryComponent,
    BannerComponent,
    FloatingButtonComponent,
    LayersSheetComponent,
    MapColumnComponent,
    MapHeadComponent,
    MapPanelComponent,
    MapObjectsDirective,
    MapOverlaysComponent,
    ObjectMenuComponent,
    ObjectSheetComponent,
    SheetComponent,
    SkeletonComponent,
    TranslatePipe,
  ],
  providers: [...MAP_PROVIDERS, MapSurface],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements OnDestroy {
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private readonly objects = viewChild(MapObjectsDirective);
  private readonly tiles = inject(TileService);
  private readonly visible = inject(VisibilityService).visible;
  private readonly viewport = inject(ViewportService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly entries = inject(EntriesState);
  private readonly sync = inject(SyncService);
  protected readonly surface = inject(MapSurface);
  protected readonly locating = inject(LocationService);

  /** Nur die Zeichenfläche, ohne Blatt und Knöpfe, für die anderen Reiter. */
  readonly surfaceOnly = input(false);

  protected readonly view = inject(MapView);
  protected readonly state = inject(MapState);
  protected readonly combination = inject(CombinationState);
  protected readonly addEntry = inject(AddEntryState);
  protected readonly wide = this.viewport.wide;

  protected readonly playback = inject(MapPlayback);
  protected readonly overlay = signal<Overlay>(null);
  protected readonly menuAt = signal<ObjectMenuTarget | null>(null);

  protected readonly offline = computed(() => !this.sync.online());

  /** Ein Eintrag braucht eine Karte ohne Blatt darüber. */
  protected readonly covered = computed(() => !this.wide() && this.overlay() !== null);

  /** Ein Blatt in voller Höhe lässt nur den Ebenen-Knopf stehen. */
  protected readonly tall = computed(() => this.covered() && overlayDetent(this.overlay()) === 2);
  /** Über der Karte liegt immer nur ein Blatt. */
  protected readonly overlaid = computed(() => this.addEntry.running() || this.state.object() !== null);
  /** Die Rasten, mit denen das Blatt der Karte zeichnet. */
  protected readonly detents = DETENT_SIZES;

  protected readonly sheetInset = computed(() => (this.wide() ? '0px' : `${DETENTS[this.state.detent()]}px`));

  constructor() {
    effect(() => {
      if (!this.visible()) this.playback.stop();
    });
    effect(() => {
      this.state.species.set(this.view.slug());
    });
    effect(() => void this.tiles.load(this.state.species()));
    void this.tiles.loadLayers();
    effect(() => {
      if (this.view.onCombination()) void this.loadSpeciesManifests();
    });
    effect(() => {
      this.surface.setStyle();
    });
    effect(() => {
      this.surface.paint();
    });
    effect(() => {
      this.surface.setOpacity(this.state.opacity(), this.view.onLayer());
    });
    effect(() => {
      this.surface.setPadding(this.state.detent(), this.wide(), this.state.overlayHeight());
    });
    effect(() => {
      this.entries.signedIn();
      void this.loadEntries();
    });
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') this.refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('visibilitychange', onVisible);
    });
    afterNextRender(() => {
      void this.surface.start(this.host().nativeElement, this.wide(), () => {
        this.onMove();
      });
    });
  }

  ngOnDestroy(): void {
    this.playback.stop();
    this.surface.destroy();
  }

  protected setDetent(detent: Detent): void {
    this.state.detent.set(detent);
  }

  /** Der Titel im Kopf öffnet die Wahl, die zur Darstellung gehört. */
  protected openTitle(): void {
    if (this.view.onCombination()) this.overlay.set('combinations');
    else this.overlay.set(this.view.onLayer() ? 'layer' : 'species');
  }

  protected openFactorFor(source: string): void {
    const factor = this.combination.factors().find((entry) => entry.source === source) ?? null;
    this.surface.inProgress.set(factor);
    this.overlay.set('factor');
  }

  protected chooseSource(layer: Layer): void {
    this.surface.inProgress.set(this.combination.start(layer.id, layer.low, layer.high));
    this.overlay.set('factor');
  }

  protected applyFactor(factor: Factor): void {
    this.combination.apply(factor);
    this.closeOverlay();
  }

  protected removeFactor(factor: Factor): void {
    this.combination.remove(factor);
    this.closeOverlay();
  }

  protected closeOverlay(): void {
    this.overlay.set(null);
    this.surface.inProgress.set(null);
  }

  /** Ohne Konto führt der Knopf zuerst zur Anmeldung. */
  protected async requestSave(): Promise<void> {
    if (await this.auth.requestSignIn()) this.overlay.set('save');
  }

  protected async saveCombination(name: string): Promise<void> {
    this.closeOverlay();
    await this.combination.save(name);
  }

  protected toCatalogue(): void {
    this.closeOverlay();
    void this.router.navigate(['/arten']);
  }

  protected openAddEntry(): void {
    this.state.layersSheetOpen.set(false);
    this.closeOverlay();
    this.addEntry.open();
  }

  /** Langes Drücken auf ein Objekt öffnet das Menü an dieser Stelle. */
  protected onObjectHeld(at: ObjectMenuTarget): void {
    this.menuAt.set(at);
  }

  /** Zentriert die Karte auf das gedrückte Objekt. */
  protected centreObject(): void {
    const hit = this.objects()?.target() ?? null;
    this.menuAt.set(null);
    if (hit !== null) this.surface.centreOn(hit.point);
  }

  private async loadSpeciesManifests(): Promise<void> {
    await Promise.all(this.view.speciesChoices().map((entry) => this.tiles.load(entry.value)));
  }

  private refresh(): void {
    this.tiles.forget();
    void this.tiles.load(this.state.species());
    void this.tiles.loadLayers();
  }

  /** Ein Schwenk holt die geteilten Funde des neuen Ausschnitts. */
  private onMove(): void {
    this.surface.paint();
    const view = this.surface.extent();
    if (view !== null) void this.entries.loadShared(view.extent);
  }

  private async loadEntries(): Promise<void> {
    await this.entries.load();
    await this.entries.sendPending();
  }
}
