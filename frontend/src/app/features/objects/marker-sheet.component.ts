import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import type { Marker } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { ViewportService } from '../../core/layout/viewport.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { MapAppLinkComponent } from '../../ui/map-app-link/map-app-link.component';
import { ObjectTitleComponent } from '../../ui/object-title/object-title.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SectionComponent } from '../../ui/section/section.component';
import { ToastService } from '../../ui/toast/toast.service';
import { longDate } from '../../core/i18n/dates';
import { visibilityText } from '../add-entry/visibility';
import { colourHex } from '../entries/colors';
import { isoDatum } from '../entries/formats';
import { EntriesStore } from '../entries/entries.store';
import { ObjectSheetStore } from './object-sheet.store';
import { ObjectFormComponent, type ObjectValues } from '../add-entry/object-form.component';

/** The object sheet of a marker and its form (boards `SheetMarkerView`, `MarkerEdit`). */
@Component({
  selector: 'app-marker-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ConfirmDialogComponent,
    MapAppLinkComponent,
    ObjectFormComponent,
    ObjectTitleComponent,
    RowGroupComponent,
    ScrollFadeDirective,
    SectionComponent,
    TranslatePipe,
  ],
  templateUrl: './marker-sheet.component.html',
  styleUrl: './marker-sheet.component.scss',
})
export class MarkerSheetComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly eintraege = inject(EntriesStore);
  protected readonly sheet = inject(ObjectSheetStore);
  protected readonly wide = inject(ViewportService).wide;

  readonly marker = input.required<Marker>();

  readonly closed = output();

  protected readonly deleteAsk = signal(false);
  protected readonly editing = this.sheet.editing;
  protected readonly busy = signal(false);

  protected readonly location = computed<readonly [number, number]>(() => [
    this.marker().lon,
    this.marker().lat,
  ]);

  /** The point in the form: a new point from the crosshair, else the saved point. */
  protected readonly place = computed(() => this.sheet.moved() ?? this.location());

  protected readonly colour = computed(() => colourHex(this.marker().colour));

  /** The muted line below the name, per `MarkerViewBody.dc.html`: kind, date and visibility. */
  protected readonly sub = computed(() => {
    const created = this.marker().createdAt;
    const visibility = visibilityText(this.i18n, this.marker().visibility);
    return created === undefined
      ? this.i18n.translate('marker.unter', { sichtbarkeit: visibility })
      : this.i18n.translate('entry.marker.sublineDated', {
          date: longDate(isoDatum(new Date(created)), this.i18n.locale()),
          visibility,
        });
  });

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
    const [lon, lat] = this.place();
    this.busy.set(true);
    try {
      if (await this.eintraege.updateMarker(this.marker(), { ...values, lat, lon })) {
        this.toasts.success(this.i18n.translate('marker.gespeichert'));
        this.sheet.setEditing(false);
      }
    } finally {
      this.busy.set(false);
    }
  }

  // The sheet closes before the request: the delete removes the marker from the list at once.
  protected async remove(): Promise<void> {
    const id = this.marker().id;
    this.deleteAsk.set(false);
    this.closed.emit();
    if (await this.eintraege.deleteMarker(id))
      this.toasts.success(this.i18n.translate('entry.marker.deleted'));
  }
}
