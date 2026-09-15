import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Find, SharedFind, Marker, Zone } from '../../core/api/models';
import { AuthService } from '../../core/auth';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { SyncService } from '../../core/offline/sync.service';
import type { SyncKind, SyncTask } from '../../core/offline/sync.types';
import { BannerComponent } from '../../ui/banner/banner.component';
import { ChoiceRowComponent } from '../../ui/choice-row/choice-row.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { FilterSheetComponent } from '../../ui/filter-sheet/filter-sheet.component';
import { EntryRowComponent, type EntryRowEntry } from '../../ui/entry-row/entry-row.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { type SegmentOption, SegmentedComponent } from '../../ui/segmented/segmented.component';
import { SpeciesState } from '../species/species.state';
import { MapState } from '../map/map.state';
import { AddEntryState } from '../add-entry/add-entry.state';
import { visibilityText } from '../add-entry/visibility';
import type { ObjectKind } from '../map/map.state';
import { EntriesState, type EntryBody } from './entries.state';
import { colourHex } from './colors';
import { hectaresText, isoDatum, shortDate } from './formats';

/** Die drei Segmente über der Liste (Boards `Entries`, `EntriesMarkers`, `EntriesZones`). */
type Segment = 'finds' | 'markers' | 'zones';

const SEGMENTS: readonly { value: Segment; label: TranslationKey; waiter: SyncKind }[] = [
  { value: 'finds', label: 'entry.finds', waiter: 'find' },
  { value: 'markers', label: 'entry.markers', waiter: 'marker' },
  { value: 'zones', label: 'entry.zones', waiter: 'zone' },
];

/** Eine Zeile der Liste, fertig für die Vorlage. */
interface Row {
  key: string;
  colour: string;
  entry: EntryRowEntry;
  pending: boolean;
  /** `null` bei einem Eintrag, der noch auf die Übertragung wartet. */
  object: { kind: ObjectKind; id: string } | null;
}

/** Der Reiter Einträge: Segment, Filter, Liste; ein Tipp öffnet das Objekt. */
@Component({
  selector: 'app-entries',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BannerComponent,
    ChoiceRowComponent,
    EmptyStateComponent,
    FilterSheetComponent,
    EntryRowComponent,
    ListRowComponent,
    PageHeaderComponent,
    SegmentedComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './entries.component.html',
  styleUrl: './entries.component.scss',
})
export class EntriesComponent {
  private readonly species = inject(SpeciesState);
  private readonly auth = inject(AuthService);
  private readonly map = inject(MapState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(EntriesState);
  private readonly addEntry = inject(AddEntryState);

  protected readonly segment = signal<Segment>('finds');
  protected readonly filterOpen = signal(false);
  protected readonly own = signal(true);
  protected readonly shared = signal(true);
  protected readonly signedIn = this.state.signedIn;
  private readonly sync = inject(SyncService);

  protected readonly offline = computed(() => !this.sync.online());

  protected readonly segments = computed<SegmentOption[]>(() =>
    SEGMENTS.map((entry) => ({ value: entry.value, label: this.i18n.translate(entry.label) })),
  );

  protected readonly filtered = computed(() => !this.own() || !this.shared());

  protected readonly rows = computed<Row[]>(() => {
    const segment = this.segment();
    const waiter = SEGMENTS.find((entry) => entry.value === segment)?.waiter ?? 'find';
    const pending = this.state
      .pendingEntries()
      .filter((entry) => entry.kind === waiter)
      .map((entry) => this.pendingRow(entry));
    if (segment === 'markers') {
      return [...pending, ...this.state.markers().map((entry) => this.markerRow(entry))];
    }
    if (segment === 'zones') return [...pending, ...this.state.zones().map((zone) => this.zoneRow(zone))];
    const own = this.own() ? this.state.finds().map((find) => this.findRow(find)) : [];
    const shared = this.shared() ? this.state.shared().map((find) => this.sharedRow(find)) : [];
    return [...pending, ...own, ...shared];
  });

  protected readonly emptyText = computed<TranslationKey>(() =>
    this.signedIn() ? 'state.noEntries' : 'state.noOwnEntriesGuest',
  );

  constructor() {
    void this.species.loadBundle();
    void this.state.loadShared();
    // Die Anmeldung kommt manchmal erst nach dem ersten Bild der Seite.
    effect(() => {
      this.signedIn();
      void this.state.load();
    });
  }

  protected signIn(): void {
    void this.auth.requestSignIn();
  }

  /** Der Weg zum Eintragen führt über die Karte: dort steht das Fadenkreuz. */
  protected async startEntry(): Promise<void> {
    await this.router.navigate(['/karte']);
    this.addEntry.open();
  }

  protected resetFilter(): void {
    this.own.set(true);
    this.shared.set(true);
  }

  protected selectSegment(value: string): void {
    const segment = SEGMENTS.find((entry) => entry.value === value);
    if (segment) this.segment.set(segment.value);
  }

  protected async open(row: Row): Promise<void> {
    if (row.object === null) return;
    await this.router.navigate(['/karte']);
    this.map.object.set(row.object);
  }

  private speciesName(id: string | null | undefined): string {
    return id === undefined || id === null ? '' : (this.species.entryById(id)?.name ?? '');
  }

  private date(iso: string): string {
    return shortDate(iso, this.i18n.locale(), isoDatum(new Date()), this.i18n.translate('common.today'));
  }

  /** „6. Sept · 3 Stück · Frederik“, so wie das Board `Entries` es schreibt. */
  private findMeta(date: string, count: number | null, person: string): string {
    if (count === null) return this.i18n.translate('find.sublineNoCount', { date, person });
    return this.i18n.translate('find.subline', { date, count, person });
  }

  /** Ein geteilter Fund nennt keinen Melder: der Vertrag führt keinen Namen. */
  private sharedMeta(date: string, count: number | null): string {
    if (count === null) return date;
    return this.i18n.translate('find.sublineShared', { date, count });
  }

  /** Der Vorname, wie ihn die Unterzeile eines Fundes nennt. */
  private firstName(): string {
    return (this.state.reporter() ?? '').split(' ')[0] ?? '';
  }

  private findRow(find: Find): Row {
    return {
      key: `find-${find.id}`,
      colour: '',
      entry: {
        title: this.speciesName(find.speciesId),
        meta: this.findMeta(this.date(find.foundOn), find.count, this.firstName()),
        note: find.note ?? undefined,
      },
      pending: false,
      object: { kind: 'find', id: find.id },
    };
  }

  private sharedRow(find: SharedFind): Row {
    return {
      key: `shared-${find.id}`,
      colour: '',
      entry: {
        title: this.speciesName(find.speciesId),
        meta: this.sharedMeta(this.date(find.foundOn), find.count),
        note: find.note ?? undefined,
      },
      pending: false,
      object: null,
    };
  }

  private markerRow(marker: Marker): Row {
    return {
      key: `marker-${marker.id}`,
      colour: colourHex(marker.colour),
      entry: {
        title: marker.name,
        meta: this.i18n.translate('entry.marker.subline', {
          note: marker.note ?? '',
          visibility: visibilityText(this.i18n, marker.visibility),
        }),
      },
      pending: false,
      object: { kind: 'marker', id: marker.id },
    };
  }

  private zoneRow(zone: Zone): Row {
    return {
      key: `zone-${zone.id}`,
      colour: colourHex(zone.colour),
      entry: {
        title: zone.name,
        meta: this.i18n.translate('entry.zone.subline', {
          area: hectaresText(zone.areaHa, this.i18n.locale()),
          visibility: visibilityText(this.i18n, zone.visibility),
        }),
      },
      pending: false,
      object: { kind: 'zone', id: zone.id },
    };
  }

  private pendingRow(entry: SyncTask<EntryBody>): Row {
    const body = entry.body;
    const find = 'foundOn' in body;
    const title = find ? this.speciesName(body.speciesId) : body.name;
    const meta = find ? this.findMeta(this.date(body.foundOn), body.count ?? null, this.firstName()) : '';
    return {
      key: `waiting-${entry.id}`,
      colour: 'colour' in body && body.colour !== undefined ? colourHex(body.colour) : '',
      entry: { title, meta, note: body.note ?? undefined },
      pending: true,
      object: null,
    };
  }
}
