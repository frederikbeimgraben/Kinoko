import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent, ToastService } from '@stupa-makers/ui-kit';
import type { SpeciesEntry, Find, FindWrite, Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PhotoPickerComponent } from '../../ui/photo-picker/photo-picker.component';
import { SegmentedComponent } from '../../ui/segmented/segmented.component';
import { SpeciesPickerComponent } from '../../ui/species-picker/species-picker.component';
import { SpeciesState } from '../species/species.state';
import { MapState } from '../map/map.state';
import { longDate } from '../../core/i18n/dates';
import { locationText } from '../../core/i18n/places';
import { isoDatum } from '../entries/formats';
import { visibilitySegments } from './visibility';
import { speciesPickerEntry } from './species-picker-entry';
import type { Location } from './add-entry.state';

/** Was das Formular abliefert: der Fund und seine noch nicht gesendeten Fotos. */
export interface FindSubmission {
  input: FindWrite;
  photos: readonly File[];
}

/**
 * Das Formular eines Fundes (Artboard `MeldenFormular`).
 *
 * Die Art ist die Art der Karte, solange niemand eine andere wählt; das Datum
 * ist heute. Das Formular prüft und gibt ab; ob daraus ein neuer Fund oder eine
 * Änderung wird, entscheidet, wer es einsetzt.
 */
@Component({
  selector: 'app-find-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    SpeciesPickerComponent,
    CheckboxComponent,
    FormFieldComponent,
    FormsModule,
    PhotoPickerComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './find-form.component.html',
  styleUrl: './find-form.component.scss',
})
export class FindFormComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly arten = inject(SpeciesState);
  private readonly map = inject(MapState);

  readonly location = input.required<Location>();
  /** Ein vorhandener Fund, wenn das Formular ihn ändert statt anzulegen. */
  readonly start = input<Find | null>(null);
  /** Ein Fund, der schon steht, bekommt seine Fotos über die eigene Route. */
  readonly withPhotos = input(true);
  readonly titel = input.required<string>();
  readonly mainText = input.required<string>();
  readonly busy = input(false);

  readonly submitted = output<FindSubmission>();
  readonly cancelled = output();

  private readonly speciesSlug = signal<string | null>(null);
  private readonly dateChoice = signal<string | null>(null);
  private readonly countChoice = signal<string | null>(null);
  private readonly noteChoice = signal<string | null>(null);
  private readonly visibilityChoice = signal<Visibility | null>(null);
  private readonly trainingChoice = signal<boolean | null>(null);

  protected readonly photos = signal<readonly File[]>([]);
  protected readonly speciesPickerOpen = signal(false);

  protected readonly segments = computed(() => visibilitySegments(this.i18n));

  protected readonly foundOn = computed(
    () => this.dateChoice() ?? this.start()?.foundOn ?? isoDatum(new Date()),
  );
  /** Der Tag in der Schreibweise der Sprache, wie ihn das Board zeigt. */
  protected readonly foundOnText = computed(() => longDate(this.foundOn(), this.i18n.locale()));
  protected readonly count = computed(() => {
    const selected = this.countChoice();
    if (selected !== null) return selected;
    const count = this.start()?.count;
    return count === null || count === undefined ? '' : String(count);
  });
  protected readonly note = computed(() => this.noteChoice() ?? this.start()?.note ?? '');
  protected readonly visibility = computed(
    () => this.visibilityChoice() ?? this.start()?.visibility ?? 'private',
  );
  // Die Freigabe ist eine bewusste Entscheidung, keine Vorgabe: aus.
  protected readonly forTraining = computed(
    () => this.trainingChoice() ?? this.start()?.forTraining ?? false,
  );

  /** Die Vorgabe ist die Art der Karte. */
  protected readonly selectedSpecies = computed<SpeciesEntry | null>(() => {
    const alle = this.arten.species();
    const chosen = this.speciesSlug();
    if (chosen !== null) return alle.find((art) => art.slug === chosen) ?? null;
    const started = this.start()?.speciesId ?? null;
    if (started !== null) return alle.find((art) => art.id === started) ?? null;
    const shown = this.map.species();
    return alle.find((art) => art.slug === shown) ?? null;
  });

  protected readonly speciesName = computed(() => this.selectedSpecies()?.name ?? '');

  protected readonly pickerSpecies = computed(() =>
    this.arten.species().map((art) => speciesPickerEntry(art, this.i18n)),
  );

  protected readonly locationLine = computed(() => {
    const [lon, lat] = this.location();
    const text = locationText(lat, lon, this.i18n.locale());
    return this.i18n.translate('melden.ort', { lat: text.lat, lon: text.lon });
  });

  constructor() {
    void this.arten.loadBundle();
  }

  protected selectSpecies(slug: string): void {
    this.speciesSlug.set(slug);
    this.speciesPickerOpen.set(false);
  }

  protected setDate(value: string): void {
    this.dateChoice.set(value);
  }

  protected setCount(value: string): void {
    this.countChoice.set(value);
  }

  protected setNote(value: string): void {
    this.noteChoice.set(value);
  }

  protected setVisibility(value: string): void {
    this.visibilityChoice.set(value === 'shared' ? 'shared' : 'private');
  }

  protected setTraining(value: boolean): void {
    this.trainingChoice.set(value);
  }

  protected submit(): void {
    const input = this.validate();
    if (input !== null) this.submitted.emit({ input, photos: this.photos() });
  }

  /**
   * Prüft, was der Vertrag verlangt: eine Art aus dem Katalog, ein Datum, das
   * nicht in der Zukunft liegt, und eine Anzahl ab eins, falls eine dasteht.
   */
  private validate(): FindWrite | null {
    const art = this.selectedSpecies();
    if (art === null) {
      this.toasts.error(this.i18n.translate('melden.artFehlt'));
      return null;
    }
    if (this.foundOn() > isoDatum(new Date())) {
      this.toasts.error(this.i18n.translate('melden.datumZukunft'));
      return null;
    }
    const raw = this.count().trim();
    const count = raw === '' ? null : Number(raw);
    if (count !== null && (!Number.isInteger(count) || count < 1)) {
      this.toasts.error(this.i18n.translate('melden.anzahlUngueltig'));
      return null;
    }
    const [lon, lat] = this.location();
    const note = this.note().trim();
    return {
      speciesId: art.id,
      lat,
      lon,
      foundOn: this.foundOn(),
      count,
      note: note === '' ? null : note,
      visibility: this.visibility(),
      forTraining: this.forTraining(),
    };
  }
}
