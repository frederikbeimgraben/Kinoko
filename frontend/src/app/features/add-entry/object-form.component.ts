import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import type { MarkerColour, Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ColourSwatchesComponent } from '../../ui/colour-swatches/colour-swatches.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { SegmentedComponent } from '../../ui/segmented/segmented.component';
import { colourSwatches, colourFromHex, colourHex } from '../entries/colors';
import { visibilitySegments } from './visibility';

/** Was ein Marker und eine Zone gemeinsam haben. */
export interface ObjectValues {
  name: string;
  colour: MarkerColour;
  note: string | null;
  visibility: Visibility;
}

/**
 * Name, Farbe, Notiz und Sichtbarkeit: die Felder, die Marker und Zone teilen
 * (Artboards `Zone` und Konzept „Marker und Zonen“).
 *
 * Die Fußleiste steht außen, denn ein neues Objekt speichert und bricht ab,
 * ein vorhandenes speichert, bearbeitet und löscht.
 */
@Component({
  selector: 'app-object-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ColourSwatchesComponent, FormFieldComponent, SegmentedComponent, TranslatePipe],
  templateUrl: './object-form.component.html',
  styleUrl: './object-form.component.scss',
})
export class ObjectFormComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);

  /** Ohne Namensfeld: das Objekt-Blatt trägt den Namen schon als Überschrift. */
  readonly withoutName = input(false);
  readonly nameLabel = input.required<string>();
  readonly namePlaceholder = input.required<string>();
  /** Der Text, wenn niemand einen Namen eingetragen hat. */
  readonly nameMissingText = input.required<string>();
  readonly start = input<ObjectValues | null>(null);

  readonly valuesChange = output<ObjectValues>();

  protected readonly name = signal<string | null>(null);
  protected readonly colour = signal<MarkerColour | null>(null);
  protected readonly note = signal<string | null>(null);
  protected readonly visibility = signal<Visibility | null>(null);

  protected readonly colors = computed(() => colourSwatches(this.i18n));
  protected readonly segments = computed(() => visibilitySegments(this.i18n));

  // Solange niemand ein Feld angefasst hat, führt der Startwert. So bleibt das
  // Formular für ein vorhandenes Objekt gefüllt, ohne es beim Öffnen zu kopieren.
  protected readonly nameValue = computed(() => this.name() ?? this.start()?.name ?? '');
  protected readonly colorValue = computed(() => this.colour() ?? this.start()?.colour ?? 'green');
  protected readonly noteValue = computed(() => this.note() ?? this.start()?.note ?? '');
  protected readonly visibilityValue = computed(
    () => this.visibility() ?? this.start()?.visibility ?? 'private',
  );
  protected readonly colorHexValue = computed(() => colourHex(this.colorValue()));

  /** Liefert die Werte oder `null`, wenn der Name fehlt. */
  values(): ObjectValues | null {
    const name = this.nameValue().trim();
    if (name === '') {
      this.toasts.error(this.nameMissingText());
      return null;
    }
    const note = this.noteValue().trim();
    return {
      name,
      colour: this.colorValue(),
      note: note === '' ? null : note,
      visibility: this.visibilityValue(),
    };
  }

  protected setColor(hex: string): void {
    this.colour.set(colourFromHex(hex));
    this.report();
  }

  protected setVisibility(value: string): void {
    this.visibility.set(value === 'shared' ? 'shared' : 'private');
    this.report();
  }

  protected setName(value: string): void {
    this.name.set(value);
    this.report();
  }

  protected setNote(value: string): void {
    this.note.set(value);
    this.report();
  }

  /** Die Vorschau auf der Karte folgt der Farbe, ohne auf Speichern zu warten. */
  private report(): void {
    this.valuesChange.emit({
      name: this.nameValue().trim(),
      colour: this.colorValue(),
      note: this.noteValue().trim() || null,
      visibility: this.visibilityValue(),
    });
  }
}
