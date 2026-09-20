import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import type { Zone } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ButtonComponent } from '../../ui/button/button.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { MapAppLinkComponent } from '../../ui/map-app-link/map-app-link.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ToastService } from '../../ui/toast/toast.service';
import { EntriesState } from '../entries/entries.state';
import { ObjectSheetState } from './object-sheet.state';
import { colourHex } from '../entries/colors';
import { asPolygon } from '../add-entry/area';
import { ObjectFormComponent, type ObjectValues } from '../add-entry/object-form.component';
import { ZONE_DRAWER, type DrawSession } from '../add-entry/zone-drawer';
import type { Location } from '../add-entry/add-entry.state';

/** Das Objekt-Blatt einer Zone; „Umriss ändern“ gibt die Ecken an Terra Draw. */
@Component({
  selector: 'app-zone-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    MapAppLinkComponent,
    ObjectFormComponent,
    RowGroupComponent,
    TranslatePipe,
  ],
  templateUrl: './zone-sheet.component.html',
  styleUrl: './zone-sheet.component.scss',
})
export class ZoneSheetComponent implements OnDestroy {
  private readonly adapter = inject(MAP_ADAPTER);
  private readonly eintraege = inject(EntriesState);
  private readonly sheet = inject(ObjectSheetState);
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly draw = inject(ZONE_DRAWER);

  readonly zone = input.required<Zone>();

  readonly closed = output();

  protected readonly deleteAsk = signal(false);
  protected readonly busy = signal(false);
  protected readonly editing = this.sheet.editing;
  protected readonly editingCorners = signal(false);
  private readonly newCorners = signal<readonly Location[] | null>(null);
  private session: DrawSession | null = null;

  protected readonly start = computed<ObjectValues>(() => {
    const zone = this.zone();
    return {
      name: zone.name,
      colour: zone.colour,
      note: zone.note,
      visibility: zone.visibility,
      groupId: zone.groupId,
    };
  });

  /** Der Mittelpunkt der Fläche: der Punkt, den eine Navigation ansteuert. */
  protected readonly center = computed<readonly [number, number]>(() => {
    const ring = this.zone().polygon.coordinates[0];
    const sum = ring.reduce((links, point) => [links[0] + point[0], links[1] + point[1]], [0, 0]);
    return [sum[0] / ring.length, sum[1] / ring.length];
  });

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

  private stopSession(): void {
    this.session?.stop();
    this.session = null;
    this.newCorners.set(null);
    this.editingCorners.set(false);
  }
}
