import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ToastService } from '@stupa-makers/ui-kit';
import type { MarkerColour, Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ColourSwatchesComponent } from '../../ui/colour-swatches/colour-swatches.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { colourSwatches, colourFromHex, colourHex } from '../entries/colors';
import { VisibilityChoiceComponent } from './visibility-choice.component';

/** Was ein Marker und eine Zone gemeinsam haben. */
export interface ObjectValues {
  name: string;
  colour: MarkerColour;
  note: string | null;
  visibility: Visibility;
  groupId: string | null;
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
    TranslatePipe,
    VisibilityChoiceComponent,
  ],
  templateUrl: './object-form.component.html',
  styleUrl: './object-form.component.scss',
})
export class ObjectFormComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);

  readonly start = input<ObjectValues | null>(null);
  /** Marker und Zone ordnen ihre Felder verschieden (Boards `MarkerForm`, `ZoneForm`). */
  readonly kind = input<'marker' | 'zone'>('marker');
  /** Ein vorhandenes Objekt trägt den Weg zurück mit Rahmen. */
  readonly editing = input(false);
  readonly busy = input(false);
  /** Der Text, wenn niemand einen Namen eingetragen hat. */
  readonly nameMissingText = input.required<string>();

  readonly submitted = output<ObjectValues>();
  readonly valuesChange = output<ObjectValues>();

  protected readonly marker = computed(() => this.kind() === 'marker');

  private readonly nameChoice = signal<string | null>(null);
  private readonly colourChoice = signal<MarkerColour | null>(null);
  private readonly noteChoice = signal<string | null>(null);
  private readonly visibilityChoice = signal<Visibility | null>(null);
  private readonly groupChoice = signal<string | null | undefined>(undefined);

  protected readonly swatches = computed(() => colourSwatches(this.i18n));

  // Solange niemand ein Feld angefasst hat, führt der Startwert.
  protected readonly name = computed(() => this.nameChoice() ?? this.start()?.name ?? '');
  protected readonly colour = computed(() => this.colourChoice() ?? this.start()?.colour ?? 'green');
  protected readonly noteText = computed(() => this.noteChoice() ?? this.start()?.note ?? '');
  protected readonly visibilityValue = computed(
    () => this.visibilityChoice() ?? this.start()?.visibility ?? 'private',
  );

  protected readonly groupValue = computed(() => {
    const chosen = this.groupChoice();
    return chosen === undefined ? (this.start()?.groupId ?? null) : chosen;
  });
  protected readonly colourHex = computed(() => colourHex(this.colour()));

  protected setColour(hex: string): void {
    this.colourChoice.set(colourFromHex(hex));
    this.report();
  }

  protected setVisibility(value: Visibility): void {
    this.visibilityChoice.set(value);
    this.report();
  }

  protected setGroup(value: string | null): void {
    this.groupChoice.set(value);
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
      groupId: this.groupValue(),
    };
  }

  /** Die Vorschau auf der Karte folgt der Farbe, ohne auf Speichern zu warten. */
  private report(): void {
    this.valuesChange.emit({
      name: this.name().trim(),
      colour: this.colour(),
      note: this.noteText().trim() || null,
      visibility: this.visibilityValue(),
      groupId: this.groupValue(),
    });
  }
}
