import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
  type OnDestroy,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SelectComponent } from '@stupa-makers/ui-kit';
import { PermissionsService } from '../../core/access/permissions.service';
import { AuthService } from '../../core/auth';
import { LICENCES, type Licence } from '../../core/api/models';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { CheckRowComponent } from '../../ui/check-row/check-row.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { LICENCE_CODE, OWN_PHOTO_KEY } from '../../ui/image-credit/licences';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { ProgressComponent } from '../../ui/progress/progress.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { SpeciesState } from '../species/species.state';
import { ImagesState } from './images.state';

/** Ein Bild anlegen oder einreichen. Das Recht `image.review` trennt beides. */
@Component({
  selector: 'app-image-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CheckRowComponent,
    FormFieldComponent,
    FormsModule,
    PageHeaderComponent,
    ProgressComponent,
    SelectComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './image-form.component.html',
  styleUrl: './image-form.component.scss',
})
export class ImageFormComponent implements OnDestroy {
  private readonly images = inject(ImagesState);
  private readonly species = inject(SpeciesState);
  private readonly rights = inject(PermissionsService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();

  /** Wer hochladen darf, legt das Bild an. Alle anderen reichen es ein. */
  protected readonly curates = computed(() => this.rights.can('image.review'));
  protected readonly title = computed(() =>
    this.i18n.translate(this.curates() ? 'image.add.title' : 'image.submit.title'),
  );
  protected readonly action = computed(() =>
    this.i18n.translate(this.curates() ? 'common.save' : 'image.submitForReview'),
  );

  protected readonly file = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);
  /** Der Name folgt der Anmeldung. Wer ein fremdes Foto einreicht, schreibt um. */
  protected readonly photographer = linkedSignal<string>(() => this.auth.user()?.name ?? '');
  protected readonly licence = signal<Licence>('own');
  protected readonly source = signal('');
  protected readonly takenOn = signal('');
  protected readonly caption = signal('');
  protected readonly cover = signal(false);

  /** Der Tag in der Schreibweise der Sprache, wie ihn das Board zeigt. */
  protected readonly takenOnText = computed(() => {
    const day = this.takenOn();
    return day === '' ? '' : longDate(day, this.i18n.locale());
  });

  protected readonly percent = this.images.percent;
  protected readonly busy = computed(() => this.percent() !== null);
  protected readonly ready = computed(() => this.file() !== null && this.photographer().trim().length > 0);

  protected readonly licences = computed(() =>
    LICENCES.map((value) => ({
      value,
      label: value === 'own' ? this.i18n.translate(OWN_PHOTO_KEY) : LICENCE_CODE[value],
    })),
  );

  protected onPick(event: Event): void {
    const field = event.target as HTMLInputElement;
    const picked = field.files?.[0] ?? null;
    field.value = '';
    if (picked === null) return;
    this.release();
    this.file.set(picked);
    this.preview.set(URL.createObjectURL(picked));
  }

  protected setLicence(value: string): void {
    this.licence.set(value as Licence);
  }

  protected async save(): Promise<void> {
    const file = this.file();
    if (file === null || this.busy()) return;
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
    void this.router.navigate(['/arten', this.slug()]);
  }

  /** Eine offene Objekt-URL bliebe sonst im Speicher. */
  ngOnDestroy(): void {
    this.release();
  }

  private release(): void {
    const held = this.preview();
    if (held !== null) URL.revokeObjectURL(held);
    this.preview.set(null);
  }
}
