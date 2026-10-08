import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, firstValueFrom, map, of } from 'rxjs';
import { PhotosApi } from '../../core/api/photos.api';
import { photoPath } from '../../core/api/models';
import type { Find, Photo } from '../../core/api/models';
import { AccountStore } from '../../core/access/account.store';
import { PersonNamesStore } from '../../core/access/person-names.store';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TileService } from '../../core/tiles/tile.service';
import { NOW } from '../../core/tiles/now';
import { currentWeek, findWeek, type ManifestWeek } from '../../core/tiles/manifest';
import { valueAtPoint } from '../../core/tiles/value-at-point';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { ObjectTitleComponent } from '../../ui/object-title/object-title.component';
import { PhotoDialogComponent } from '../../ui/photo-dialog/photo-dialog.component';
import { PhotoStripComponent, type StripPhoto } from '../../ui/photo-strip/photo-strip.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { ToastService } from '../../ui/toast/toast.service';
import { findSubline } from '../entries/find-subline';
import { SpeciesState } from '../species/species.state';
import { EntriesState } from '../entries/entries.state';
import { ObjectSheetStore } from './object-sheet.store';
import { FindFormComponent, type FindSubmission } from '../add-entry/find-form.component';
import { MapStore } from '../map/map.store';

/** Das Objekt-Blatt eines Fundes; die Kennzahl kommt aus der Wertkachel der Karte. */
@Component({
  selector: 'app-find-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    FindFormComponent,
    LevelPillComponent,
    ListRowComponent,
    ObjectTitleComponent,
    PhotoDialogComponent,
    PhotoStripComponent,
    RowGroupComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './find-sheet.component.html',
  styleUrl: './find-sheet.component.scss',
})
export class FindSheetComponent {
  private readonly account = inject(AccountStore);
  private readonly names = inject(PersonNamesStore);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly arten = inject(SpeciesState);
  private readonly eintraege = inject(EntriesState);
  protected readonly sheet = inject(ObjectSheetStore);
  private readonly map = inject(MapStore);
  private readonly tiles = inject(TileService);
  private readonly photos = inject(PhotosApi);
  private readonly now = inject(NOW);

  readonly find = input.required<Find>();

  readonly closed = output();

  protected readonly editing = this.sheet.editing;
  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);
  protected readonly viewing = signal<number | null>(null);
  private readonly injector = inject(Injector);
  private tile: HTMLElement | null = null;

  /** The photos of the find that the service knows. The strip and the form show them. */
  private readonly photoList = rxResource({
    params: () => this.find().id,
    stream: ({ params: findId }) =>
      this.photos.list({ findId }).pipe(
        map((page): readonly Photo[] => page.items),
        // Without the list, the form shows only the new files.
        catchError(() => of<readonly Photo[]>([])),
      ),
  });
  protected readonly held = computed(() => this.photoList.value() ?? []);

  /** The value of the active week at the find. */
  private readonly reading = resource({
    params: () => ({ find: this.find(), weekKey: this.map.week(), slug: this.forecastSlug() }),
    loader: ({ params }) => this.readValue(params.find, params.weekKey, params.slug),
  });
  private readonly week = computed(() => this.reading.value()?.week ?? null);
  private readonly value = computed(() => this.reading.value()?.value ?? null);

  protected readonly strip = computed<readonly StripPhoto[]>(() =>
    this.held().map((one) => ({ id: one.id, path: photoPath(one.id, 'list'), lead: one.lead })),
  );

  protected readonly art = computed(() => {
    const id = this.find().speciesId;
    return id === null ? null : this.arten.entryById(id);
  });

  protected readonly speciesName = computed(() => this.art()?.name ?? '');

  /** Only a species with a forecast map gives a value. */
  private readonly forecastSlug = computed(() => {
    const art = this.art();
    return art?.forecastEnabled ? art.slug : null;
  });
  protected readonly location = computed<readonly [number, number]>(() => [this.find().lon, this.find().lat]);

  /** Die gedämpfte Zeile unter dem Namen: Datum, Anzahl, Melder. */
  protected readonly sub = computed(() => {
    const date = longDate(this.find().foundOn, this.i18n.locale());
    return findSubline(this.i18n, date, this.find().count, this.reporterName());
  });

  protected readonly thumbPhoto = computed(() => this.strip()[0]?.path ?? '');

  /** Die Plakette neben dem Namen, solange der Fund geteilt ist. */
  protected readonly shared = computed(() => this.find().visibility === 'shared');

  /** Der eigene Name kommt aus dem Konto, ein fremder nur bei gemeinsamer Gruppe. */
  private reporterName(): string | null {
    const find = this.find();
    if (this.account.owns(find.ownerId)) return this.eintraege.reporter() ?? '';
    return this.names.nameOf(find.ownerId);
  }

  /** Der Fund rückt in die Mitte der Karte; das Blatt macht ihn frei. */
  protected showOnMap(): void {
    this.closed.emit();
  }

  /** „Steinpilz, KW 40 · 2025, je Begehung“ — jede Zahl nennt ihren Bezug. */
  protected readonly valueScope = computed(() => {
    const week = this.week();
    if (week === null) return '';
    return this.i18n.translate('fund.vorhersageUnter', {
      art: this.speciesName(),
      woche: week.week,
      jahr: week.year,
    });
  });

  protected readonly valueText = computed(() => {
    const value = this.value();
    return value === null ? null : this.i18n.translate('karte.prozent', { wert: Math.round(value * 100) });
  });

  constructor() {
    void this.arten.loadBundle();
  }

  /** Nimmt ein vorhandenes Foto weg und holt die Liste neu. */
  protected async removePhoto(id: string): Promise<void> {
    try {
      await firstValueFrom(this.photos.remove(id));
    } catch {
      this.toasts.error(this.i18n.translate('melden.verworfen'));
      return;
    }
    this.photoList.reload();
  }

  protected openPhoto(index: number): void {
    const active = document.activeElement;
    this.tile = active instanceof HTMLElement ? active : null;
    this.viewing.set(index);
  }

  protected closeGallery(): void {
    this.viewing.set(null);
    afterNextRender(() => this.tile?.focus(), { injector: this.injector });
  }

  protected async save(submission: FindSubmission): Promise<void> {
    this.busy.set(true);
    try {
      if (await this.eintraege.updateFind(this.find(), submission.input)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
        this.sheet.setEditing(false);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    this.deleteAsk.set(false);
    if (await this.eintraege.deleteFind(this.find().id)) {
      this.toasts.success(this.i18n.translate('fund.geloescht'));
      this.closed.emit();
    }
  }

  /**
   * Reads the value of the active week at the find. Without a forecast map for the species,
   * the row stays away and does not show a false zero.
   */
  private async readValue(
    find: Find,
    weekKey: string | null,
    slug: string | null,
  ): Promise<{ week: ManifestWeek; value: number | null } | null> {
    if (slug === null) return null;
    try {
      await this.tiles.load(slug);
      const manifest = this.tiles.manifestOf(slug);
      if (manifest === null) return null;
      const week =
        (weekKey !== null ? findWeek(manifest, weekKey) : null) ?? currentWeek(manifest, this.now());
      if (week === null) return null;
      return { week, value: await valueAtPoint(manifest, week.tilePath, find.lon, find.lat) };
    } catch {
      // Without a manifest, there is no value with a reference, so no row.
      return null;
    }
  }
}
