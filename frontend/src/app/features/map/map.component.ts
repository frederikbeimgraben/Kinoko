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
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { LocationService } from '../../core/location/location.service';
import { SyncService } from '../../core/offline/sync.service';
import { TileService } from '../../core/tiles/tile.service';
import type { Layer } from '../../core/tiles/layers';
import { MAP_PROVIDERS } from '../../map/map.tokens';
import { BannerComponent } from '../../ui/banner/banner.component';
import { MapAttributionComponent } from '../../ui/map-attribution/map-attribution.component';
import { ObjectMenuComponent, type ObjectMenuTarget } from '../../ui/object-menu/object-menu.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { SkeletonComponent } from '../../ui/skeleton/skeleton.component';
import { AddEntryComponent } from '../add-entry/add-entry.component';
import { AddEntryStore } from '../add-entry/add-entry.store';
import { EntriesState } from '../entries/entries.state';
import { MapObjectsDirective } from '../objects/map-objects.directive';
import { ObjectSheetComponent } from '../objects/object-sheet.component';
import { CombinationStore } from './combination.store';
import { FactorPickerComponent } from './factor-picker.component';
import { LayersSheetComponent } from './layers-sheet.component';
import { MapButtonsComponent } from './map-buttons.component';
import { MapColumnComponent } from './map-column.component';
import { MapOverlayStore } from './map-overlay.store';
import { MapPanelBodyComponent } from './map-panel-body.component';
import { MapPanelComponent } from './map-panel.component';
import { MapOverlaysComponent } from './map-overlays.component';
import { MapPlayback } from './map-playback';
import { DETENT_SIZES, MapSurface } from './map-surface';
import { MapStore } from './map.store';
import { MapView } from './map.view';

/** The map tab: the background, the value tiles and the sheet over them. */
@Component({
  selector: 'app-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddEntryComponent,
    BannerComponent,
    FactorPickerComponent,
    LayersSheetComponent,
    MapButtonsComponent,
    MapAttributionComponent,
    MapColumnComponent,
    MapPanelBodyComponent,
    MapPanelComponent,
    MapObjectsDirective,
    MapOverlaysComponent,
    ObjectMenuComponent,
    ObjectSheetComponent,
    SheetComponent,
    SkeletonComponent,
    TranslatePipe,
  ],
  providers: [...MAP_PROVIDERS, MapSurface, MapOverlayStore],
  templateUrl: './map.component.html',
  styleUrl: './map.component.scss',
})
export class MapComponent implements OnDestroy {
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('canvas');
  private readonly objects = viewChild(MapObjectsDirective);
  private readonly tiles = inject(TileService);
  private readonly viewport = inject(ViewportService);
  private readonly entries = inject(EntriesState);
  private readonly sync = inject(SyncService);
  protected readonly surface = inject(MapSurface);
  protected readonly locating = inject(LocationService);
  protected readonly overlayNav = inject(MapOverlayStore);

  /** Only the canvas, without the sheet and the buttons, for the other tabs. */
  readonly surfaceOnly = input(false);

  protected readonly view = inject(MapView);
  protected readonly state = inject(MapStore);
  protected readonly combination = inject(CombinationStore);
  protected readonly addEntry = inject(AddEntryStore);
  protected readonly wide = this.viewport.wide;

  protected readonly playback = inject(MapPlayback);
  protected readonly overlay = this.overlayNav.overlay;
  protected readonly menuAt = signal<ObjectMenuTarget | null>(null);
  /** On the phone, outside the map tab, the canvas stays hidden in the shell. */
  protected readonly hidden = computed(() => !this.wide() && this.surfaceOnly());
  protected readonly offline = computed(() => !this.sync.online());

  /** On the phone, a sheet over the map covers the map sheet. */
  protected readonly covered = computed(() => !this.wide() && this.overlay() !== null);

  /** The sources that have a factor. The choice does not show them. */
  protected readonly usedSources = computed(
    () => new Set(this.combination.factors().map((factor) => factor.source)),
  );

  /** The forecast of the shown species is available as a factor. */
  protected readonly speciesLayers = computed<readonly Layer[]>(() => {
    const layer = this.view.sources().get(this.view.slug());
    return layer ? [layer] : [];
  });

  /** The compass shows only over a turned or tilted map. */
  protected readonly turned = computed(() => {
    const turn = this.surface.rotation();
    return turn.bearing !== 0 || turn.pitch !== 0;
  });

  /** North is at minus `bearing`: MapLibre turns against the view direction. */
  protected readonly needle = computed(() => -this.surface.rotation().bearing);

  /** A step that looks for a point gets the full map, without the column and the buttons. */
  protected readonly aiming = this.addEntry.showsCrosshair;

  /** The map buttons stay below each sheet and modal, as the boards show them. */
  protected readonly showsButtons = computed(() => !this.aiming());

  /** Only one sheet is over the map at a time. */
  protected readonly overlaid = computed(() => this.addEntry.running() || this.state.object() !== null);

  /** The map sheet of the phone. Each other sheet over the map replaces it. */
  protected readonly showsMapSheet = computed(
    () => !this.wide() && !this.overlaid() && !this.covered() && !this.state.layersSheetOpen(),
  );

  /**
   * The add button. It goes away while the flow behind it runs, and on the phone below a sheet.
   * The tall map sheet of the phone has no room for it (board `MapCombination`).
   */
  protected readonly showsAdd = computed(() => {
    if (this.overlay() !== null || this.addEntry.running()) return false;
    if (this.wide()) return true;
    return !this.state.layersSheetOpen() && !(this.showsMapSheet() && this.state.detent() === 2);
  });

  /** The detents of the map sheet. Above the lowest one, the sheet is as high as its content. */
  protected readonly detents = DETENT_SIZES;

  /**
   * The kit `.karte` ends 28 px below the top of the map sheet, and the mark is 8 px above its end.
   * The mark thus stays below the round top of the sheet, as on the board `Map`.
   */
  protected readonly attributionAbove = computed(() =>
    this.showsMapSheet() ? 'calc(var(--pilz-sheet-inset, 0px) - 28px)' : null,
  );

  constructor() {
    // A canvas that shows again measures its size again.
    effect(() => {
      if (!this.hidden()) this.surface.resize();
    });
    effect(() => void this.tiles.load(this.view.slug()));
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
    this.surface.destroy();
  }

  protected async saveCombination(name: string): Promise<void> {
    this.overlayNav.close();
    await this.combination.save(name);
  }

  protected openAddEntry(): void {
    this.state.setLayersSheetOpen(false);
    this.overlayNav.close();
    this.addEntry.open();
  }

  /** A long press on an object opens the menu at that point. */
  protected onObjectHeld(at: ObjectMenuTarget): void {
    this.menuAt.set(at);
  }

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
    void this.tiles.load(this.view.slug());
    void this.tiles.loadLayers();
  }

  /** A pan loads the shared finds of the new extent. */
  private onMove(): void {
    this.state.countMove();
    this.surface.paint();
    const view = this.surface.extent();
    if (view !== null) void this.entries.loadShared(view.extent);
  }

  private async loadEntries(): Promise<void> {
    await this.entries.load();
    await this.entries.sendPending();
  }
}
