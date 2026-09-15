import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, ButtonComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import { photoPath, type Photo, type PhotoState } from '../../core/api/models';
import { PhotosApi } from '../../core/api/photos.api';
import { longDate } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';
import { SpeciesState } from '../species/species.state';

const STATE_BADGE: Record<PhotoState, BadgeVariant> = {
  private: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

const STATE_TEXT: Record<PhotoState, TranslationKey> = {
  private: 'enum.photo_state.private',
  submitted: 'enum.photo_state.submitted',
  approved: 'enum.photo_state.approved',
  rejected: 'enum.photo_state.rejected',
};

/** Eine Einreichung, fertig für die Vorlage. */
interface Row {
  id: string;
  species: string;
  thumbPath: string;
  alt: string;
  submitted: string;
  badge: BadgeVariant;
  badgeText: string;
  reason: string | null;
}

/** „Meine Bilder“ unter dem Konto: je Einreichung ihr Zustand und der Grund. */
@Component({
  selector: 'app-my-images',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    TranslatePipe,
  ],
  templateUrl: './my-images.component.html',
  styleUrl: './my-images.component.scss',
})
export class MyImagesComponent {
  private readonly api = inject(PhotosApi);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly species = inject(SpeciesState);

  private readonly photos = signal<readonly Photo[]>([]);
  private readonly cursor = signal<string | null>(null);

  protected readonly loaded = signal(false);
  protected readonly loading = signal(false);
  protected readonly more = computed(() => this.cursor() !== null);

  protected readonly rows = computed<Row[]>(() =>
    this.photos().map((image) => {
      const name = this.nameOf(image.speciesId ?? null);
      return {
        id: image.id,
        species: name,
        thumbPath: photoPath(image.id, 'list'),
        alt: image.caption ?? name,
        submitted: this.i18n.translate('bild.eingereichtAm', {
          datum: longDate(image.createdAt.slice(0, 10), this.i18n.locale()),
        }),
        badge: STATE_BADGE[image.state],
        badgeText: this.i18n.translate(STATE_TEXT[image.state]),
        reason: image.rejectReason ?? null,
      };
    }),
  );

  constructor() {
    void this.species.loadBundle();
    this.fetch();
  }

  protected loadMore(): void {
    this.fetch();
  }

  protected back(): void {
    void this.router.navigateByUrl('/konto');
  }

  private fetch(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.api.list({ mine: true, cursor: this.cursor() ?? undefined }).subscribe({
      next: (page) => {
        this.photos.update((all) => [...all, ...page.items]);
        this.cursor.set(page.nextCursor);
        this.loading.set(false);
        this.loaded.set(true);
      },
      error: () => {
        this.loading.set(false);
        this.loaded.set(true);
      },
    });
  }

  private nameOf(speciesId: string | null): string {
    return this.species.species().find((entry) => entry.id === speciesId)?.name ?? '';
  }
}
