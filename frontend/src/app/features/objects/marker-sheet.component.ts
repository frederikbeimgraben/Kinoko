import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import type { Marker } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { MapAppLinkComponent } from '../../ui/map-app-link/map-app-link.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { EntriesState } from '../entries/entries.state';
import { ObjectSheetState } from './object-sheet.state';
import { ObjectFormComponent, type ObjectValues } from '../add-entry/object-form.component';

/** Das Objekt-Blatt eines Markers und sein Formular (Boards `MarkerSheet`, `MarkerEdit`). */
@Component({
  selector: 'app-marker-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ConfirmDialogComponent,
    MapAppLinkComponent,
    ObjectFormComponent,
    RowGroupComponent,
    TranslatePipe,
  ],
  templateUrl: './marker-sheet.component.html',
  styleUrl: './marker-sheet.component.scss',
})
export class MarkerSheetComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly eintraege = inject(EntriesState);
  private readonly sheet = inject(ObjectSheetState);

  readonly marker = input.required<Marker>();

  readonly closed = output();

  protected readonly deleteAsk = signal(false);
  protected readonly editing = this.sheet.editing;
  protected readonly busy = signal(false);

  protected readonly location = computed<readonly [number, number]>(() => [
    this.marker().lon,
    this.marker().lat,
  ]);

  protected readonly start = computed<ObjectValues>(() => {
    const marker = this.marker();
    return {
      name: marker.name,
      colour: marker.colour,
      note: marker.note,
      visibility: marker.visibility,
      groupId: marker.groupId,
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
