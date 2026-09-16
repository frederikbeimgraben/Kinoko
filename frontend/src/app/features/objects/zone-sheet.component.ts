import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ButtonComponent, CardComponent, ToastService } from '@stupa-makers/ui-kit';
import { firstValueFrom } from 'rxjs';
import { EntriesApi } from '../../core/api/entries.api';
import type { Zone, ZoneValue } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { currentWeek, findWeek } from '../../core/tiles/manifest';
import { TileService } from '../../core/tiles/tile.service';
import { NOW } from '../../core/tiles/now';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { SpeciesState } from '../species/species.state';
import { EntriesState } from '../entries/entries.state';
import { colourHex } from '../entries/colors';
import { asPolygon } from '../add-entry/area';
import { ObjectFormComponent, type ObjectValues } from '../add-entry/object-form.component';
import { ZONE_DRAWER, type DrawSession } from '../add-entry/zone-drawer';
import { MapState } from '../map/map.state';
import type { Location } from '../add-entry/add-entry.state';

/** Das Objekt-Blatt einer Zone; „Umriss ändern“ gibt die Ecken an Terra Draw. */
@Component({
  selector: 'app-zone-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ButtonComponent,
    CardComponent,
    ConfirmDialogComponent,
    ListRowComponent,
    ObjectFormComponent,
    TranslatePipe,
  ],
  templateUrl: './zone-sheet.component.html',
  styleUrl: './zone-sheet.component.scss',
})
export class ZoneSheetComponent implements OnDestroy {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly api = inject(EntriesApi);
  private readonly arten = inject(SpeciesState);
  private readonly eintraege = inject(EntriesState);
  private readonly i18n = inject(I18nService);
  private readonly map = inject(MapState);
  private readonly tiles = inject(TileService);
  private readonly now = inject(NOW);
  private readonly toasts = inject(ToastService);
  private readonly draw = inject(ZONE_DRAWER);

  readonly zone = input.required<Zone>();

  readonly closed = output();

  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);
  protected readonly editing = signal(false);
  protected readonly editingCorners = signal(false);
  private readonly value = signal<ZoneValue | null>(null);
  private readonly newCorners = signal<readonly Location[] | null>(null);
  private session: DrawSession | null = null;

  protected readonly colour = computed(() => colourHex(this.zone().colour));

  protected readonly start = computed<ObjectValues>(() => {
    const zone = this.zone();
    return { name: zone.name, colour: zone.colour, note: zone.note, visibility: zone.visibility };
  });

  protected readonly forecastRow = computed(() => {
    const value = this.value();
    if (value === null) return null;
    return {
      label: this.i18n.translate('zone.vorhersage', {
        art: this.speciesName(value.speciesId),
        woche: value.week,
      }),
      value: this.i18n.translate('karte.prozent', { wert: Math.round(value.areaMean) }),
      finds: String(value.ownFinds),
    };
  });

  /** Der Mittelpunkt der Fläche: der Punkt, den eine Navigation ansteuert. */
  protected readonly center = computed<readonly [number, number]>(() => {
    const ring = this.zone().polygon.coordinates[0];
    const sum = ring.reduce((links, point) => [links[0] + point[0], links[1] + point[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  });

  constructor() {
    void this.arten.loadBundle();
    effect(() => {
      void this.fetchValue(this.zone().id, this.map.species(), this.map.week());
    });
  }

  ngOnDestroy(): void {
    this.stopSession();
  }

  protected async save(values: ObjectValues): Promise<void> {
    this.busy.set(true);
    try {
      if (await this.eintraege.updateZone(this.zone(), values)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
        this.editing.set(false);
      }
    } finally {
      this.busy.set(false);
    }
  }

  /** Gibt die Ecken an Terra Draw. Sie lassen sich dann mit dem Finger ziehen. */
  protected async editCorners(): Promise<void> {
    const map = this.adapter.rawMap();
    if (map === null) return;
    this.editing.set(false);
    this.editingCorners.set(true);
    this.session = await this.draw(map, colourHex(this.zone().colour));
    const ring = this.zone()
      .polygon.coordinates[0].slice(0, -1)
      .map((point) => [point[0], point[1]] as Location);
    this.session.showRing(ring);
    this.session.edit((next) => {
      this.newCorners.set(next);
    });
  }

  protected async applyCorners(): Promise<void> {
    const corners = this.newCorners();
    const polygon = corners === null ? null : asPolygon(corners);
    this.stopSession();
    if (polygon === null) return;
    if (await this.eintraege.updateZone(this.zone(), { polygon })) {
      this.toasts.success(this.i18n.translate('objekt.gespeichert'));
    }
  }

  protected cancelCorners(): void {
    this.stopSession();
  }

  protected async remove(): Promise<void> {
    this.deleteAsk.set(false);
    if (await this.eintraege.deleteZone(this.zone().id)) {
      this.toasts.success(this.i18n.translate('objekt.geloescht'));
      this.closed.emit();
    }
  }

  private speciesName(id: string): string {
    return this.arten.entryById(id)?.name ?? '';
  }

  /** Fragt den Dienst nach dem Flächenmittel der Art in der Woche. */
  private async fetchValue(id: string, chosen: string, weekKey: string | null): Promise<void> {
    this.value.set(null);
    const art = this.arten.entryOf(chosen);
    if (!art?.forecastEnabled) return;
    try {
      await this.tiles.load(art.slug);
      const manifest = this.tiles.manifestOf(art.slug);
      if (manifest === null) return;
      const week =
        (weekKey !== null ? findWeek(manifest, weekKey) : null) ?? currentWeek(manifest, this.now());
      if (week === null) return;
      this.value.set(await firstValueFrom(this.api.zoneValue(id, art.id, week.year, week.week)));
    } catch {
      // Ohne Karte für diese Art und Woche bleibt die Zeile weg.
    }
  }

  private stopSession(): void {
    this.session?.stop();
    this.session = null;
    this.newCorners.set(null);
    this.editingCorners.set(false);
  }
}
