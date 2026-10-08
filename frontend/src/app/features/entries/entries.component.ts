import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GroupsStore } from '../../core/access/groups.store';
import { PersonNamesStore } from '../../core/access/person-names.store';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { SyncStore } from '../../core/offline/sync.store';
import { BannerComponent } from '../../ui/banner/banner.component';
import { EntryListComponent } from '../../ui/entry-list/entry-list.component';
import { FilterChipComponent } from '../../ui/filter-chip/filter-chip.component';
import { FilterSheetComponent } from '../../ui/filter-sheet/filter-sheet.component';
import { FloatingButtonComponent } from '../../ui/floating-button/floating-button.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SkeletonComponent } from '../../ui/skeleton/skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SurfaceComponent } from '../../ui/surface/surface.component';
import type { IconName } from '../../ui/svg-icon/svg-icon.component';
import { MyImagesStore } from '../account/my-images.store';
import { AddEntryState } from '../add-entry/add-entry.state';
import { ObjectSheetState } from '../objects/object-sheet.state';
import { SpeciesState } from '../species/species.state';
import { entriesBanner } from './entries-banner';
import { EntriesStore } from './entries.store';
import { EntriesFilterBodyComponent } from './entries-filter-body.component';
import { NO_FILTER, isFiltered, passes, type EntriesFilter, type FilterContext } from './entry-filter';
import {
  byDay,
  markerRow,
  ownFindRow,
  pendingRow,
  sharedFindRow,
  zoneRow,
  type EntryRow,
  type RowContext,
  type Segment,
} from './entry-rows';
import { firstName, isoDatum } from './formats';

/** The chips above the list, per `Entries.dc.html`. */
const SEGMENTS: readonly { value: Segment; label: TranslationKey; icon: IconName; kind: string }[] = [
  { value: 'finds', label: 'entry.finds', icon: 'mushroom', kind: 'find' },
  { value: 'markers', label: 'entry.markers', icon: 'flag', kind: 'marker' },
  { value: 'zones', label: 'entry.zones', icon: 'zone', kind: 'zone' },
];

/** The entry tab, per `Entries.dc.html`: chips, filter, list and the pending banner. A tap opens the object. */
@Component({
  selector: 'app-entries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BannerComponent,
    EntriesFilterBodyComponent,
    EntryListComponent,
    FilterChipComponent,
    FilterSheetComponent,
    FloatingButtonComponent,
    IconButtonComponent,
    NgTemplateOutlet,
    PageHeaderComponent,
    ScrollFadeDirective,
    SkeletonComponent,
    StateViewComponent,
    SurfaceComponent,
    TranslatePipe,
  ],
  templateUrl: './entries.component.html',
  styleUrl: './entries.component.scss',
})
export class EntriesComponent {
  private readonly addEntry = inject(AddEntryState);
  private readonly auth = inject(AuthService);
  private readonly groups = inject(GroupsStore);
  private readonly i18n = inject(I18nService);
  private readonly names = inject(PersonNamesStore);
  private readonly photos = inject(MyImagesStore);
  private readonly router = inject(Router);
  private readonly sheet = inject(ObjectSheetState);
  private readonly species = inject(SpeciesState);
  private readonly store = inject(EntriesStore);
  private readonly sync = inject(SyncStore);

  /** On the desktop the floating button of the map adds an entry. */
  protected readonly wide = inject(ViewportService).wide;
  protected readonly signedIn = this.store.signedIn;
  protected readonly segments = SEGMENTS;
  protected readonly segment = signal<Segment>('finds');
  protected readonly filterOpen = signal(false);

  protected readonly filter = this.store.filter;
  protected readonly filtered = computed(() => isFiltered(this.filter()));
  protected readonly zones = this.store.zones;
  protected readonly groupList = computed(() => this.groups.groups() ?? []);

  /** The day of the list. A list that stays open over midnight keeps its day. */
  protected readonly today = isoDatum(new Date());

  /** The zone of the zone filter, per `EntriesZone.dc.html`. */
  protected readonly zoneChip = computed(() => {
    const id = this.filter().zoneId;
    return id === null ? null : (this.store.zones().find((zone) => zone.id === id) ?? null);
  });

  private readonly context = computed<RowContext>(() => {
    // The rows follow the bundle and the names: a name that arrives later fills its row.
    this.species.species();
    return {
      i18n: this.i18n,
      today: this.today,
      species: (id) => (id ? this.species.entryById(id) : null),
      reporter: firstName(this.store.reporter()),
      person: (ownerId) => {
        const name = this.names.nameOf(ownerId);
        return name === null ? null : firstName(name);
      },
    };
  });

  private readonly filterContext = computed<FilterContext>(() => ({
    today: this.today,
    zone: this.zoneChip()?.polygon ?? null,
    photoFinds: this.photos.findIds(),
  }));

  /** Shared finds of other people. The own shared finds are in the own list already. */
  private readonly othersFinds = computed(() => {
    const own = new Set(this.store.finds().map((find) => find.id));
    return this.store.shared().filter((find) => !own.has(find.id));
  });

  /** The finds that pass the filter, each with its row. */
  private readonly findRows = computed<readonly EntryRow[]>(() => {
    const context = this.context();
    const filter = this.filter();
    const check = this.filterContext();
    const own = this.store
      .finds()
      .filter((find) => passes(find, filter, check))
      .map((find) => ownFindRow(context, find));
    const others = this.othersFinds()
      .filter((find) => passes({ ...find, visibility: 'shared', groupId: null }, filter, check))
      .map((find) => sharedFindRow(context, find));
    return [...own, ...others];
  });

  private readonly pending = computed(() => {
    const context = this.context();
    return this.store.pendingEntries().map((task) => ({ kind: task.kind, row: pendingRow(context, task) }));
  });

  protected readonly rows = computed<readonly EntryRow[]>(() => {
    const segment = this.segment();
    const kind = SEGMENTS.find((entry) => entry.value === segment)?.kind;
    const pending = this.pending()
      .filter((entry) => entry.kind === kind)
      .map((entry) => entry.row);
    const context = this.context();
    const items =
      segment === 'finds'
        ? this.findRows()
        : segment === 'markers'
          ? this.store.markers().map((marker) => markerRow(context, marker))
          : this.store.zones().map((zone) => zoneRow(context, zone));
    return byDay([...pending, ...items]);
  });

  /** The number in the main button of the filter sheet. */
  protected readonly matchCount = computed(() => {
    const count = this.findRows().length;
    return count === 1
      ? this.i18n.translate('entry.filter.showOne')
      : this.i18n.translate('entry.filter.showCount', { count });
  });

  /** The first answer is pending and the device has nothing: the list is a skeleton. */
  protected readonly waiting = computed(
    () => this.store.loading() && this.rows().length === 0 && this.pending().length === 0,
  );

  protected readonly emptyText = computed<TranslationKey>(() =>
    this.filtered() && this.segment() === 'finds' ? 'entry.noMatch' : 'state.noEntries',
  );

  protected readonly banner = computed(() =>
    entriesBanner(this.sync.pendingCount(), this.sync.online(), this.i18n),
  );

  constructor() {
    void this.species.loadBundle();
    void this.store.loadShared();
    this.store.loadOnSignIn(this.signedIn);
    this.groups.load(false, true);
  }

  protected selectSegment(segment: Segment): void {
    this.segment.set(segment);
  }

  protected changeFilter(filter: EntriesFilter): void {
    if (filter.withPhoto && !this.photos.loaded()) this.photos.load();
    this.store.setFilter(filter);
  }

  protected resetFilter(): void {
    this.store.setFilter(NO_FILTER);
  }

  protected clearZone(): void {
    this.store.setFilter({ ...this.filter(), zoneId: null });
  }

  protected signIn(): void {
    void this.auth.requestSignIn();
  }

  protected send(): void {
    void this.store.sendPending();
  }

  /** An entry starts on the map: the crosshair is there. */
  protected async startEntry(): Promise<void> {
    await this.router.navigate(['/karte']);
    this.addEntry.open();
  }

  protected async open(row: EntryRow): Promise<void> {
    if (row.object === null) return;
    await this.router.navigate(['/karte']);
    this.sheet.show(row.object.kind, row.object.id);
  }
}
