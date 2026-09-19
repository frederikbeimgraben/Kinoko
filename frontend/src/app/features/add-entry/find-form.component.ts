import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { ToastService } from '@stupa-makers/ui-kit';
import type { SpeciesEntry, Find, FindWrite, Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { PhotoPickerComponent, type HeldPhoto } from '../../ui/photo-picker/photo-picker.component';
import { SheetComponent, type DetentSize } from '../../ui/sheet/sheet.component';
import { SwitchComponent } from '../../ui/switch/switch.component';
import { SpeciesPickerComponent } from '../../ui/species-picker/species-picker.component';
import { SpeciesState } from '../species/species.state';
import { MapState } from '../map/map.state';
import { numericDate } from '../../core/i18n/dates';
import { isoDatum } from '../entries/formats';
import { speciesPickerEntry } from '../species/species-picker-entry';
import { VisibilityChoiceComponent } from './visibility-choice.component';
import type { Location } from './add-entry.state';

/** Was das Formular abliefert: der Fund und seine noch nicht gesendeten Fotos. */
export interface FindSubmission {
  input: FindWrite;
  photos: readonly File[];
}

/** Die Artwahl steht über dem Formular und füllt fast die ganze Höhe. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = [0.9, 0.9, 0.9];

/** Das Formular eines Fundes (Boards `FindForm` und `MapDesktopFindForm`). */
@Component({
  selector: 'app-find-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    SpeciesPickerComponent,
    FormFieldComponent,
    OverlayHostComponent,
    PhotoPickerComponent,
    SheetComponent,
    SwitchComponent,
    VisibilityChoiceComponent,
    TranslatePipe,
  ],
  templateUrl: './find-form.component.html',
  styleUrl: './find-form.component.scss',
})
export class FindFormComponent {
  private readonly i18n = inject(I18nService);
  private readonly toasts = inject(ToastService);
  private readonly species = inject(SpeciesState);
  private readonly map = inject(MapState);

  readonly location = input.required<Location>();
  /** Ein vorhandener Fund, wenn das Formular ihn ändert statt anzulegen. */
  readonly start = input<Find | null>(null);
  readonly withPhotos = input(true);
  /** Die Fotos, die der Dienst zu diesem Fund schon hat. */
  readonly held = input<readonly HeldPhoto[]>([]);
  /** Ein vorhandener Fund zeigt den Pfeil an der Art und einen Rahmen am Weg zurück. */
  readonly editing = input(false);
  readonly busy = input(false);

  readonly submitted = output<FindSubmission>();
  readonly heldRemoved = output<string>();

  protected readonly DETENTS = DETENTS;

  private readonly slugChoice = signal<string | null>(null);
  protected readonly visibilityChoice = signal<Visibility | null>(null);
  protected readonly groupChoice = signal<string | null | undefined>(undefined);

  protected readonly dateChoice = signal<string | null>(null);
  protected readonly countChoice = signal<string | null>(null);
  protected readonly noteChoice = signal<string | null>(null);
  protected readonly photos = signal<readonly File[]>([]);
  protected readonly trainingChoice = signal<boolean | null>(null);
  protected readonly pickerOpen = signal(false);

  protected readonly date = computed(
    () => this.dateChoice() ?? this.start()?.foundOn ?? isoDatum(new Date()),
  );
  protected readonly dateText = computed(() =>
    numericDate(this.date(), (key, values) => this.i18n.translate(key as TranslationKey, values)),
  );
  protected readonly count = computed(() => {
    const chosen = this.countChoice();
    if (chosen !== null) return chosen;
    const count = this.start()?.count;
    return count === null || count === undefined ? '' : String(count);
  });
  protected readonly note = computed(() => this.noteChoice() ?? this.start()?.note ?? '');
  protected readonly training = computed(() => this.trainingChoice() ?? this.start()?.forTraining ?? false);

  protected removeHeld(id: string): void {
    this.heldRemoved.emit(id);
  }
  protected readonly visibility = computed(
    () => this.visibilityChoice() ?? this.start()?.visibility ?? 'private',
  );

  protected readonly groupId = computed(() => {
    const chosen = this.groupChoice();
    return chosen === undefined ? (this.start()?.groupId ?? null) : chosen;
  });

  /** Die Vorgabe ist die Art der Karte. */
  protected readonly selectedSpecies = computed<SpeciesEntry | null>(() => {
    const chosen = this.slugChoice();
    if (chosen !== null) return this.species.entryOf(chosen);
    const started = this.start()?.speciesId ?? null;
    if (started !== null) return this.species.entryById(started);
    return this.species.entryOf(this.map.species());
  });

  protected readonly speciesName = computed(() => this.selectedSpecies()?.name ?? '');

  protected readonly pickerSpecies = computed(() =>
    this.species.species().map((entry) => speciesPickerEntry(entry, this.i18n)),
  );

  constructor() {
    void this.species.loadBundle();
  }

  protected selectSpecies(slug: string): void {
    this.slugChoice.set(slug);
    this.pickerOpen.set(false);
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
    const species = this.selectedSpecies();
    if (species === null) {
      this.toasts.error(this.i18n.translate('melden.artFehlt'));
      return null;
    }
    if (this.date() > isoDatum(new Date())) {
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
      speciesId: species.id,
      lat,
      lon,
      foundOn: this.date(),
      count,
      note: note === '' ? null : note,
      visibility: this.visibility(),
      groupId: this.groupId(),
      forTraining: this.training(),
    };
  }
}
