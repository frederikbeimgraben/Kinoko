import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ToastService } from '@stupa-makers/ui-kit';
import type { MarkerColour, Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ColourSwatchesComponent } from '../../ui/colour-swatches/colour-swatches.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { SegmentedComponent } from '../../ui/segmented/segmented.component';
import { colourSwatches, colourFromHex, colourHex } from '../entries/colors';
import { coordinatesText } from './coordinates';
import { visibilitySegments } from './visibility';
import type { Location } from './add-entry.state';

/** Was ein Marker und eine Zone gemeinsam haben. */
export interface ObjectValues {
  name: string;
  colour: MarkerColour;
  note: string | null;
  visibility: Visibility;
}

/** Name, Farbe, Notiz und Sichtbarkeit: die Felder von Marker und Zone. */
@Component({
  selector: 'app-object-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ColourSwatchesComponent,
    FormFieldComponent,
    NgTemplateOutlet,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './object-form.component.html',
  styleUrl: './object-form.component.scss',
})
export class ObjectFormComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);

  readonly heading = input.required<string>();
  readonly location = input<Location | null>(null);
  readonly start = input<ObjectValues | null>(null);
  /** Marker und Zone ordnen ihre Felder verschieden (Boards `MarkerForm`, `ZoneForm`). */
  readonly kind = input<'marker' | 'zone'>('marker');
  /** Ein vorhandenes Objekt trägt den Weg zurück mit Rahmen. */
  readonly editing = input(false);
  readonly busy = input(false);
  /** Der Text, wenn niemand einen Namen eingetragen hat. */
  readonly nameMissingText = input.required<string>();

  readonly submitted = output<ObjectValues>();
  readonly cancelled = output();
  readonly valuesChange = output<ObjectValues>();

  protected readonly wide = inject(ViewportService).wide;

  protected readonly marker = computed(() => this.kind() === 'marker');

  private readonly nameChoice = signal<string | null>(null);
  private readonly colourChoice = signal<MarkerColour | null>(null);
  private readonly noteChoice = signal<string | null>(null);
  private readonly visibilityChoice = signal<Visibility | null>(null);

  protected readonly swatches = computed(() => colourSwatches(this.i18n));
  protected readonly segments = computed(() => visibilitySegments(this.i18n));
  protected readonly coordinates = computed(() => coordinatesText(this.location(), this.i18n));

  protected readonly secondaryLabel = computed(() =>
    this.wide() ? undefined : this.i18n.translate('common.cancel'),
  );

  // Solange niemand ein Feld angefasst hat, führt der Startwert.
  protected readonly name = computed(() => this.nameChoice() ?? this.start()?.name ?? '');
  protected readonly colour = computed(() => this.colourChoice() ?? this.start()?.colour ?? 'green');
  protected readonly noteText = computed(() => this.noteChoice() ?? this.start()?.note ?? '');
  protected readonly visibilityValue = computed(
    () => this.visibilityChoice() ?? this.start()?.visibility ?? 'private',
  );
  protected readonly colourHex = computed(() => colourHex(this.colour()));

  protected setColour(hex: string): void {
    this.colourChoice.set(colourFromHex(hex));
    this.report();
  }

  protected setVisibility(value: string): void {
    this.visibilityChoice.set(value === 'shared' ? 'shared' : 'private');
    this.report();
  }

  protected setName(value: string): void {
    this.nameChoice.set(value);
    this.report();
  }

  protected setNote(value: string): void {
    this.noteChoice.set(value);
    this.report();
  }

  protected submit(): void {
    const values = this.values();
    if (values !== null) this.submitted.emit(values);
  }

  /** Liefert die Werte oder `null`, wenn der Name fehlt. */
  private values(): ObjectValues | null {
    const name = this.name().trim();
    if (name === '') {
      this.toasts.error(this.nameMissingText());
      return null;
    }
    const note = this.noteText().trim();
    return {
      name,
      colour: this.colour(),
      note: note === '' ? null : note,
      visibility: this.visibilityValue(),
    };
  }

  /** Die Vorschau auf der Karte folgt der Farbe, ohne auf Speichern zu warten. */
  private report(): void {
    this.valuesChange.emit({
      name: this.name().trim(),
      colour: this.colour(),
      note: this.noteText().trim() || null,
      visibility: this.visibilityValue(),
    });
  }
}
