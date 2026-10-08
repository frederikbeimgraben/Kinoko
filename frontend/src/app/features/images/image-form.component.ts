import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { PermissionsStore } from '../../core/access/permissions.store';
import { HistoryService } from '../../core/navigation/history.service';
import { AuthService } from '../../core/auth';
import { LICENCES, type Licence } from '../../core/api/models';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CheckRowComponent } from '../../ui/check-row/check-row.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { FormSheetComponent } from '../../ui/form-sheet/form-sheet.component';
import { LICENCE_CODE, OWN_PHOTO_KEY } from '../../ui/image-credit/licences';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { PhotoStripComponent } from '../../ui/photo-strip/photo-strip.component';
import { ProgressComponent } from '../../ui/progress/progress.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SpeciesPageComponent } from '../species/species-page.component';
import { SpeciesStore } from '../species/species.store';
import { ImagesStore } from './images.store';

/**
 * Adds or submits a photo in a sheet over the species page, per `ImageSubmit.dc.html`.
 * The right `image.review` adds; each other person submits for review.
 */
@Component({
  selector: 'app-image-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CheckRowComponent,
    FormFieldComponent,
    FormSheetComponent,
    ListRowComponent,
    OptionSheetComponent,
    PhotoStripComponent,
    ProgressComponent,
    RowGroupComponent,
    SpeciesPageComponent,
    TranslatePipe,
  ],
  templateUrl: './image-form.component.html',
  styleUrl: './image-form.component.scss',
})
export class ImageFormComponent {
  private readonly images = inject(ImagesStore);
  private readonly species = inject(SpeciesStore);
  private readonly rights = inject(PermissionsStore);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly history = inject(HistoryService);

  readonly slug = input.required<string>();

  /** A person who reviews photos adds the photo. Each other person submits it. */
  protected readonly curates = computed(() => this.rights.can('image.review'));
  protected readonly title = computed(() =>
    this.i18n.translate(this.curates() ? 'image.add.title' : 'image.submit.title'),
  );
  protected readonly action = computed(() =>
    this.i18n.translate(this.curates() ? 'common.save' : 'image.submit.action'),
  );

  protected readonly files = signal<readonly File[]>([]);
  /** The name follows the sign-in. A person who submits a photo of another person changes it. */
  protected readonly photographer = linkedSignal<string>(() => this.auth.user()?.name ?? '');
  protected readonly licence = signal<Licence>('own');
  protected readonly picking = signal(false);
  protected readonly source = signal('');
  protected readonly takenOn = signal('');
  protected readonly caption = signal('');
  protected readonly cover = signal(false);

  /** The day in the notation of the language, as the board shows it. */
  protected readonly takenOnText = computed(() => {
    const day = this.takenOn();
    return day === '' ? '' : longDate(day, this.i18n.locale());
  });

  protected readonly percent = this.images.percent;
  protected readonly busy = computed(() => this.percent() !== null);

  protected readonly licences = computed<OptionSheetOption[]>(() =>
    LICENCES.map((value) => ({ id: value, title: this.licenceLabel(value) })),
  );

  protected readonly licenceLabel = (value: Licence): string =>
    value === 'own' ? this.i18n.translate(OWN_PHOTO_KEY) : LICENCE_CODE[value];

  protected setLicence(value: string): void {
    this.licence.set(value as Licence);
    this.picking.set(false);
  }

  protected async save(): Promise<void> {
    const file = this.files().at(0);
    if (file === undefined || this.photographer().trim() === '' || this.busy()) return;
    const done = await this.images.submit(
      {
        speciesId: this.species.entryOf(this.slug())?.id,
        photographer: this.photographer().trim(),
        licence: this.licence(),
        caption: this.caption().trim() || undefined,
        source: this.source().trim() || undefined,
        takenOn: this.takenOn() || undefined,
      },
      file,
    );
    if (done !== null && this.cover()) await this.images.setLead(done.id);
    this.cancel();
  }

  protected cancel(): void {
    this.history.back(['/arten', this.slug()]);
  }
}
