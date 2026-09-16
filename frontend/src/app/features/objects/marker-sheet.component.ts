import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { CardComponent, ToastService } from '@stupa-makers/ui-kit';
import type { Marker } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { EntriesState } from '../entries/entries.state';
import { colourHex } from '../entries/colors';
import { ObjectFormComponent, type ObjectValues } from '../add-entry/object-form.component';
import { openGoogleMaps } from './map-links';

/** Das Objekt-Blatt eines Markers und sein Formular (Boards `MarkerSheet`, `MarkerEdit`). */
@Component({
  selector: 'app-marker-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CardComponent,
    ConfirmDialogComponent,
    ListRowComponent,
    ObjectFormComponent,
    TranslatePipe,
  ],
  templateUrl: './marker-sheet.component.html',
  styleUrl: './marker-sheet.component.scss',
})
export class MarkerSheetComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly eintraege = inject(EntriesState);

  readonly marker = input.required<Marker>();

  readonly closed = output();

  protected readonly deleteAsk = signal(false);
  protected readonly editing = signal(false);
  protected readonly busy = signal(false);

  protected readonly location = computed<readonly [number, number]>(() => [
    this.marker().lon,
    this.marker().lat,
  ]);

  protected toGoogleMaps(): void {
    openGoogleMaps(this.location());
  }

  protected readonly colour = computed(() => colourHex(this.marker().colour));

  protected readonly start = computed<ObjectValues>(() => {
    const marker = this.marker();
    return {
      name: marker.name,
      colour: marker.colour,
      note: marker.note,
      visibility: marker.visibility,
    };
  });

  protected async save(values: ObjectValues): Promise<void> {
    this.busy.set(true);
    try {
      if (await this.eintraege.updateMarker(this.marker(), values)) {
        this.toasts.success(this.i18n.translate('objekt.gespeichert'));
        this.editing.set(false);
      }
    } finally {
      this.busy.set(false);
    }
  }

  protected async remove(): Promise<void> {
    this.deleteAsk.set(false);
    if (await this.eintraege.deleteMarker(this.marker().id)) {
      this.toasts.success(this.i18n.translate('objekt.geloescht'));
      this.closed.emit();
    }
  }
}
