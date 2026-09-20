import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PhotosApi } from '../../core/api/photos.api';
import { photoPath } from '../../core/api/models';
import type { Find } from '../../core/api/models';
import { AccountService } from '../../core/access/account.service';
import { PersonNamesService } from '../../core/access/person-names.service';
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
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { ToastService } from '../../ui/toast/toast.service';
import { findSubline } from '../entries/find-subline';
import { SpeciesState } from '../species/species.state';
import { EntriesState } from '../entries/entries.state';
import { ObjectSheetState } from './object-sheet.state';
import { FindFormComponent, type FindSubmission } from '../add-entry/find-form.component';
import { MapState } from '../map/map.state';
import { PhotoGalleryComponent } from './photo-gallery.component';

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
    PhotoGalleryComponent,
    RowGroupComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './find-sheet.component.html',
  styleUrl: './find-sheet.component.scss',
})
export class FindSheetComponent {
  private readonly account = inject(AccountService);
  private readonly names = inject(PersonNamesService);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly arten = inject(SpeciesState);
  private readonly eintraege = inject(EntriesState);
  private readonly sheet = inject(ObjectSheetState);
  private readonly map = inject(MapState);
  private readonly tiles = inject(TileService);
  private readonly photos = inject(PhotosApi);
  private readonly now = inject(NOW);

  readonly find = input.required<Find>();

  readonly closed = output();

  protected readonly editing = this.sheet.editing;
  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);
  private readonly week = signal<ManifestWeek | null>(null);
  /** Die Fotos, die der Dienst zu dem Fund kennt; das Formular zeigt sie. */
  protected readonly held = signal<readonly { id: string; path: string }[]>([]);
  private readonly value = signal<number | null>(null);

  protected readonly art = computed(() => {
    const id = this.find().speciesId;
    return id === null ? null : this.arten.entryById(id);
  });

  protected readonly speciesName = computed(() => this.art()?.name ?? '');
  protected readonly location = computed<readonly [number, number]>(() => [this.find().lon, this.find().lat]);

  /** Die gedämpfte Zeile unter dem Namen: Datum, Anzahl, Melder. */
  protected readonly sub = computed(() => {
    const date = longDate(this.find().foundOn, this.i18n.locale());
    return findSubline(this.i18n, date, this.find().count, this.reporterName());
  });

  protected readonly thumbPhoto = computed(() => this.held()[0]?.path ?? '');

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
    effect(() => {
      void this.fetchValue(this.find(), this.map.week());
    });
    effect(() => {
      void this.loadPhotos(this.find().id);
    });
  }

  /** Nimmt ein vorhandenes Foto weg und holt die Liste neu. */
  protected async removePhoto(id: string): Promise<void> {
    try {
      await firstValueFrom(this.photos.remove(id));
    } catch {
      this.toasts.error(this.i18n.translate('melden.verworfen'));
      return;
    }
    await this.loadPhotos(this.find().id);
  }

  private async loadPhotos(findId: string): Promise<void> {
    try {
      const page = await firstValueFrom(this.photos.list({ findId }));
      this.held.set(page.items.map((photo) => ({ id: photo.id, path: photoPath(photo.id, 'list') })));
    } catch {
      // Ohne Liste zeigt das Formular nur die neuen Dateien.
      this.held.set([]);
    }
  }

  protected async save(submission: FindSubmission): Promise<void> {
    this.busy.set(true);
    try {
      if (await this.eintraege.updateFind(this.find(), submission.input)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
        this.editing.set(false);
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
   * Liest den Wert der aktiven Woche am Ort des Fundes. Ohne Vorhersagekarte
   * für diese Art bleibt die Zeile weg, statt eine Null zu behaupten.
   */
  private async fetchValue(find: Find, weekKey: string | null): Promise<void> {
    this.value.set(null);
    this.week.set(null);
    const art = this.art();
    if (!art?.forecastEnabled) return;
    try {
      await this.tiles.load(art.slug);
      const manifest = this.tiles.manifestOf(art.slug);
      if (manifest === null) return;
      const week =
        (weekKey !== null ? findWeek(manifest, weekKey) : null) ?? currentWeek(manifest, this.now());
      if (week === null) return;
      this.week.set(week);
      this.value.set(await valueAtPoint(manifest, week.tilePath, find.lon, find.lat));
    } catch {
      // Ohne Manifest gibt es keine Zahl mit Bezug, also auch keine Zeile.
    }
  }
}
