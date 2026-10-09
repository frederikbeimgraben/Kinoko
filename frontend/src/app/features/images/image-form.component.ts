import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PermissionsStore } from '../../core/access/permissions.store';
import { HistoryService } from '../../core/navigation/history.service';
import { AuthService } from '../../core/auth';
import { LICENCES, type Licence } from '../../core/api/models';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { FormSheetComponent } from '../../ui/form-sheet/form-sheet.component';
import { LICENCE_CODE, OWN_PHOTO_KEY } from '../../ui/image-credit/licences';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PhotoStripComponent } from '../../ui/photo-strip/photo-strip.component';
import { ProgressComponent } from '../../ui/progress/progress.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { SwitchComponent } from '../../ui/switch/switch.component';
import { ToastService } from '../../ui/toast/toast.service';
import { SpeciesDeskComponent } from '../species/species-desk.component';
import { SpeciesPageComponent } from '../species/species-page.component';
import { SpeciesStore } from '../species/species.store';
import { ImagesStore } from './images.store';

/** The licences of a photo from another source, per the board `ImageAdd`. */
const CURATED_LICENCES: readonly Licence[] = ['cc_by_4', 'cc_by_sa_4', 'cc0'];

/** Adds a photo on a page (board `ImageAdd`) or submits it in a sheet over the species page (board `ImageSubmit`). */
@Component({
  selector: 'app-image-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    FormSheetComponent,
    ListRowComponent,
    NgTemplateOutlet,
    OptionSheetComponent,
    PageHeaderComponent,
    PhotoStripComponent,
    ProgressComponent,
    RowGroupComponent,
    SegmentedComponent,
    SpeciesDeskComponent,
    SpeciesPageComponent,
    SwitchComponent,
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
  private readonly toasts = inject(ToastService);

  readonly slug = input.required<string>();

  protected readonly wide = inject(ViewportService).wide;

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
  /** A curated photo comes from another source, so its licence is not `own`. */
  protected readonly licence = linkedSignal<Licence>(() => (this.curates() ? 'cc_by_4' : 'own'));
  protected readonly picking = signal(false);
  protected readonly source = signal('');
  protected readonly takenOn = signal('');
  protected readonly caption = signal('');
  protected readonly cover = signal(false);
  /** True after the first press of the main button: from then on the missing fields show their error. */
  protected readonly tried = signal(false);
  protected readonly failed = signal(false);

  /** The day in the notation of the language, as the board shows it. */
  protected readonly takenOnText = computed(() => {
    const day = this.takenOn();
    return day === '' ? '' : longDate(day, this.i18n.locale());
  });

  protected readonly percent = this.images.percent;
  protected readonly busy = computed(() => this.percent() !== null);

  protected readonly photoError = computed(() =>
    this.tried() && this.files().length === 0 ? this.i18n.translate('image.field.photoMissing') : null,
  );
  protected readonly photographerError = computed(() =>
    this.tried() && this.photographer().trim() === ''
      ? this.i18n.translate('image.field.authorMissing')
      : null,
  );

  protected readonly licences = computed<OptionSheetOption[]>(() =>
    LICENCES.map((value) => ({ id: value, title: this.licenceLabel(value) })),
  );
  protected readonly curatedLicences = computed<SegmentOption[]>(() =>
    CURATED_LICENCES.map((value) => ({ value, label: this.licenceLabel(value) })),
  );

  protected readonly licenceLabel = (value: Licence): string =>
    value === 'own' ? this.i18n.translate(OWN_PHOTO_KEY) : LICENCE_CODE[value];

  protected setLicence(value: string): void {
    this.licence.set(value as Licence);
    this.picking.set(false);
  }

  protected setFiles(files: readonly File[]): void {
    this.files.set(files);
    this.failed.set(false);
  }

  /** A failed upload keeps the sheet and the photo, so the person can send it again. */
  protected async save(): Promise<void> {
    this.tried.set(true);
    const file = this.files().at(0);
    if (file === undefined || this.photographerError() !== null || this.busy()) return;
    this.failed.set(false);
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
    if (done === null && !this.images.queued()) {
      this.failed.set(true);
      return;
    }
    // The service puts each species photo into the review. A curator adds it, so it approves it at once.
    if (done !== null && this.curates()) await this.images.approve(done.id);
    if (done !== null && this.cover()) await this.images.setLead(done.id);
    this.toasts.success(this.i18n.translate(this.doneKey(done === null)));
    this.cancel();
  }

  protected cancel(): void {
    this.history.back(['/arten', this.slug()]);
  }

  private doneKey(queued: boolean): TranslationKey {
    if (queued) return 'image.submit.queued';
    return this.curates() ? 'image.add.done' : 'image.submit.done';
  }
}
