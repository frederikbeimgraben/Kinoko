import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { MARKER_COLOURS, type MarkerColour, type Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FilterChipComponent } from '../../ui/filter-chip/filter-chip.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SectionComponent } from '../../ui/section/section.component';
import { ToastService } from '../../ui/toast/toast.service';
import { colourHex } from '../entries/colors';
import { hectaresText } from '../entries/formats';
import type { Location } from './add-entry.store';
import { coordinatesText } from './coordinates';

/** The values that a marker and a zone share. */
export interface ObjectValues {
  name: string;
  colour: MarkerColour;
  note: string | null;
  visibility: Visibility;
  groupId: string | null;
}

/** Name, note and colour of a marker or a zone (boards `MarkerFormBody`, `ZoneFormBody`).
 * The form keeps the visibility of the start values: the boards show no choice for it. */
@Component({
  selector: 'app-object-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FilterChipComponent,
    FormFieldComponent,
    ListRowComponent,
    RowGroupComponent,
    ScrollFadeDirective,
    SectionComponent,
    TranslatePipe,
  ],
  templateUrl: './object-form.component.html',
  styleUrl: './object-form.component.scss',
})
export class ObjectFormComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);

  readonly start = input<ObjectValues | null>(null);
  readonly kind = input<'marker' | 'zone'>('marker');
  readonly busy = input(false);
  /** The error text when the name is empty. */
  readonly nameMissingText = input.required<string>();
  /** The point of a marker. The row "Ort" opens the crosshair step. */
  readonly location = input<Location | null>(null);
  /** The area of a zone in hectares, for the row "Fläche". */
  readonly area = input<number | null>(null);

  readonly submitted = output<ObjectValues>();
  /** The row "Ort" gives the values, so the flow can keep them during the crosshair step. */
  readonly locationClick = output<ObjectValues>();
  /** "Umriss ändern" of a zone, with the values of the form. */
  readonly outlineClick = output<ObjectValues>();

  protected readonly marker = computed(() => this.kind() === 'marker');

  private readonly nameChoice = signal<string | null>(null);
  private readonly colourChoice = signal<MarkerColour | null>(null);
  private readonly noteChoice = signal<string | null>(null);

  protected readonly chips = computed(() =>
    MARKER_COLOURS.map((value) => ({
      value,
      hex: colourHex(value),
      label: this.i18n.translate(`enum.colour.${value}`),
    })),
  );

  // Until the user changes a field, the start value applies.
  protected readonly name = computed(() => this.nameChoice() ?? this.start()?.name ?? '');
  protected readonly colour = computed(() => this.colourChoice() ?? this.start()?.colour ?? 'green');
  protected readonly noteText = computed(() => this.noteChoice() ?? this.start()?.note ?? '');

  protected readonly place = computed(() => coordinatesText(this.location(), this.i18n));
  protected readonly areaText = computed(() => hectaresText(this.area() ?? 0, this.i18n.locale()));

  /** The current values of the form, also with an empty name. */
  protected readonly current = computed<ObjectValues>(() => {
    const note = this.noteText().trim();
    return {
      name: this.name().trim(),
      colour: this.colour(),
      note: note === '' ? null : note,
      visibility: this.start()?.visibility ?? 'private',
      groupId: this.start()?.groupId ?? null,
    };
  });

  protected setColour(value: MarkerColour): void {
    this.colourChoice.set(value);
  }

  protected setName(value: string): void {
    this.nameChoice.set(value);
  }

  protected setNote(value: string): void {
    this.noteChoice.set(value);
  }

  protected submit(): void {
    const values = this.current();
    if (values.name === '') {
      this.toasts.error(this.nameMissingText());
      return;
    }
    this.submitted.emit(values);
  }
}
