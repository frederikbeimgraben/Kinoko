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
import { BadgeComponent, ButtonComponent, CardComponent, ToastService } from '@stupa-makers/ui-kit';
import type { Find } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TileService } from '../../core/tiles/tile.service';
import { NOW } from '../../core/tiles/now';
import { currentWeek, findWeek, type ManifestWeek } from '../../core/tiles/manifest';
import { valueAtPoint } from '../../core/tiles/value-at-point';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { SpeciesState } from '../species/species.state';
import { EntriesState } from '../entries/entries.state';
import { longDate } from '../../core/i18n/dates';
import { FindFormComponent, type FindSubmission } from '../add-entry/find-form.component';
import { MapState } from '../map/map.state';
import { PhotoGalleryComponent } from './photo-gallery.component';

/** Das Objekt-Blatt eines Fundes; die Kennzahl kommt aus der Wertkachel der Karte. */
@Component({
  selector: 'app-find-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    ConfirmDialogComponent,
    FindFormComponent,
    ListRowComponent,
    PhotoGalleryComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './find-sheet.component.html',
  styleUrl: './find-sheet.component.scss',
})
export class FindSheetComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly arten = inject(SpeciesState);
  private readonly eintraege = inject(EntriesState);
  private readonly map = inject(MapState);
  private readonly tiles = inject(TileService);
  private readonly now = inject(NOW);

  readonly find = input.required<Find>();

  readonly closed = output();

  protected readonly editing = signal(false);
  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);
  private readonly week = signal<ManifestWeek | null>(null);
  private readonly value = signal<number | null>(null);

  protected readonly art = computed(() => {
    const id = this.find().speciesId;
    return id === null ? null : this.arten.entryById(id);
  });

  protected readonly speciesName = computed(() => this.art()?.name ?? '');
  protected readonly geteilt = computed(() => this.find().visibility === 'shared');
  protected readonly location = computed<readonly [number, number]>(() => [this.find().lon, this.find().lat]);

  /** Der Fund rückt in die Mitte der Karte; das Blatt macht ihn frei. */
  protected showOnMap(): void {
    this.closed.emit();
  }

  protected readonly subline = computed(() => {
    const find = this.find();
    const date = longDate(find.foundOn, this.i18n.locale());
    const person = this.eintraege.reporter() ?? '';
    if (find.count === null) return this.i18n.translate('find.sublineNoCount', { date, person });
    return this.i18n.translate('find.subline', { date, count: find.count, person });
  });

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
