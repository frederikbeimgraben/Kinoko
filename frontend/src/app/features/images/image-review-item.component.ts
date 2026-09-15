import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent } from '@stupa-makers/ui-kit';
import { photoPath } from '../../core/api/models';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { KeyValueRowComponent } from '../../ui/key-value-table/key-value-row.component';
import { KeyValueTableComponent } from '../../ui/key-value-table/key-value-table.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';
import { RejectDialogComponent } from '../../ui/reject-dialog/reject-dialog.component';
import { SpeciesState } from '../species/species.state';
import { ImagesState } from './images.state';
import { licenceText } from './review-card';

const SEPARATOR = ' · ';

/** Eine einzelne Einreichung: Bild, Angaben, freigeben oder ablehnen. */
@Component({
  selector: 'app-image-review-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    BadgeComponent,
    KeyValueRowComponent,
    KeyValueTableComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    RejectDialogComponent,
    TranslatePipe,
  ],
  templateUrl: './image-review-item.component.html',
  styleUrl: './image-review-item.component.scss',
})
export class ImageReviewItemComponent {
  private readonly images = inject(ImagesState);
  private readonly species = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();

  protected readonly asking = signal(false);

  protected readonly photo = computed(() => this.images.photoOf(this.id()));
  protected readonly path = computed(() => photoPath(this.id(), 'full'));

  protected readonly speciesName = computed(() => {
    const speciesId = this.photo()?.speciesId;
    return this.species.species().find((entry) => entry.id === speciesId)?.name ?? '';
  });

  protected readonly alt = computed(() => this.photo()?.caption ?? this.speciesName());

  protected readonly counter = computed(() =>
    this.i18n.translate('common.counter', {
      done: this.images.positionOf(this.id()),
      total: this.images.photos().length,
    }),
  );

  protected readonly submitted = computed(() => {
    const one = this.photo();
    if (one === null) return '';
    const day = longDate(one.createdAt.slice(0, 10), this.i18n.locale());
    return `${one.photographer}${SEPARATOR}${day}`;
  });

  protected readonly licence = computed(() => {
    const one = this.photo();
    return one === null ? '' : licenceText(one, this.i18n);
  });

  constructor() {
    void this.species.loadBundle();
    if (this.images.photos().length === 0) this.images.load({ state: 'submitted' });
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/bilder']);
  }

  protected async approve(): Promise<void> {
    await this.images.approve(this.id());
    this.back();
  }

  protected async reject(reason: string): Promise<void> {
    this.asking.set(false);
    await this.images.reject(this.id(), reason);
    this.back();
  }
}
