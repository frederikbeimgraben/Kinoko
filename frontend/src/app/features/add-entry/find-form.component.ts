import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import type { SpeciesEntry, Find, FindWrite, Visibility } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { PhotoStripComponent, type StripPhoto } from '../../ui/photo-strip/photo-strip.component';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { SwitchComponent } from '../../ui/switch/switch.component';
import { ToastService } from '../../ui/toast/toast.service';
import { SpeciesPickerComponent } from '../../ui/species-picker/species-picker.component';
import { SpeciesStore } from '../species/species.store';
import { MapStore } from '../map/map.store';
import { numericDate } from '../../core/i18n/dates';
import { isoDatum } from '../entries/formats';
import { speciesPickerEntry } from '../species/species-picker-entry';
import { VisibilityChoiceComponent } from './visibility-choice.component';
import type { Location } from './add-entry.store';
import { EMPTY_FIND_DRAFT, type FindDraft } from './find-draft';
import { coordinatesText } from './coordinates';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SectionComponent } from '../../ui/section/section.component';

/** The result of the form: the find and its photos that are not sent yet. */
export interface FindSubmission {
  input: FindWrite;
  photos: readonly File[];
}

/** The species choice is above the form and fills almost the full height. */

/** The form of a find (boards `FindForm` and `MapDesktopFindForm`). */
@Component({
  selector: 'app-find-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ListRowComponent,
    RowGroupComponent,
    ScrollFadeDirective,
    SectionComponent,
    ActionBarComponent,
    SpeciesPickerComponent,
    FormFieldComponent,
    OverlayHostComponent,
    PhotoStripComponent,
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
  private readonly species = inject(SpeciesStore);
  private readonly map = inject(MapStore);

  readonly location = input.required<Location>();

  /** The location as text, per the row `Ort` of the board `FindFormBody`. */
  protected readonly place = computed(() => coordinatesText(this.location(), this.i18n));
  /** An existing find, when the form changes it. */
  readonly start = input<Find | null>(null);
  readonly withPhotos = input(true);
  /** The photos of this find that the service has. */
  readonly held = input<readonly StripPhoto[]>([]);
  /** An existing find shows the chevron at the species and a border at the back way. */
  readonly editing = input(false);
  readonly busy = input(false);
  /** The choices from before a return to the location step. */
  readonly draft = input<FindDraft>(EMPTY_FIND_DRAFT);

  readonly submitted = output<FindSubmission>();
  readonly heldRemoved = output<string>();
  /** The location row goes back to the location step. It gives the choices, so the flow can keep them. */
  readonly locationClick = output<FindDraft>();

  private readonly slugChoice = linkedSignal(() => this.draft().slug);
  protected readonly visibilityChoice = linkedSignal<Visibility | null>(() => this.draft().visibility);
  protected readonly groupChoice = linkedSignal<string | null | undefined>(() => this.draft().group);

  protected readonly dateChoice = linkedSignal(() => this.draft().date);
  protected readonly countChoice = linkedSignal(() => this.draft().count);
  protected readonly noteChoice = linkedSignal(() => this.draft().note);
  protected readonly photos = linkedSignal<readonly File[]>(() => this.draft().photos);
  protected readonly trainingChoice = linkedSignal(() => this.draft().training);
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

  /** A new find starts with the species of the map. A find without a species keeps none until a choice. */
  protected readonly selectedSpecies = computed<SpeciesEntry | null>(() => {
    const chosen = this.slugChoice();
    if (chosen !== null) return this.species.entryOf(chosen);
    const start = this.start();
    if (start !== null) return start.speciesId === null ? null : this.species.entryById(start.speciesId);
    return this.species.entryOf(this.map.species());
  });

  /** An existing find without a species can stay without one. */
  private readonly keepsNoSpecies = computed(
    () => this.start()?.speciesId === null && this.slugChoice() === null,
  );

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

  protected editLocation(): void {
    this.locationClick.emit({
      slug: this.slugChoice(),
      visibility: this.visibilityChoice(),
      group: this.groupChoice(),
      date: this.dateChoice(),
      count: this.countChoice(),
      note: this.noteChoice(),
      photos: this.photos(),
      training: this.trainingChoice(),
    });
  }

  protected submit(): void {
    const input = this.validate();
    if (input !== null) this.submitted.emit({ input, photos: this.photos() });
  }

  /** Checks the contract: a catalogue species, a date that is not in the future, and a count of 1 or more. */
  private validate(): FindWrite | null {
    const species = this.selectedSpecies();
    if (species === null && !this.keepsNoSpecies()) {
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
      speciesId: species?.id ?? null,
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
