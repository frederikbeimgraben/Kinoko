import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { photoCaption, photoPath, type Photo, type PhotoState } from '../../core/api/models';
import { shortDay } from '../../core/i18n/dates';
import { I18nService } from '../../core/i18n/i18n.service';
import { joined } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ViewportService } from '../../core/layout/viewport.service';
import { ButtonComponent } from '../../ui/button/button.component';
import type { BadgeKind } from '../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { EntriesStore } from '../entries/entries.store';
import { SpeciesStore } from '../species/species.store';
import { MyImagesStore } from './my-images.store';

/** The badge, the badge word and the state word of each review state, per `MyImages.dc.html`. */
const STATE: Readonly<Record<PhotoState, { kind: BadgeKind; badge: TranslationKey; text: TranslationKey }>> =
  {
    private: { kind: '', badge: 'image.badge.private', text: 'image.state.private' },
    submitted: { kind: 'warn', badge: 'image.badge.submitted', text: 'image.state.submitted' },
    approved: { kind: 'ok', badge: 'image.badge.approved', text: 'image.state.approved' },
    rejected: { kind: 'bad', badge: 'image.badge.rejected', text: 'image.state.rejected' },
  };

/** One own photo, ready for the template. */
interface Row {
  readonly id: string;
  readonly title: string;
  readonly sub: string;
  readonly thumb: string;
  readonly badge: string;
  readonly kind: BadgeKind;
  /** The way to the image page, `null` without a known species. */
  readonly link: readonly string[] | null;
}

/** "My images" below the account: each photo with its review state and the reason of a rejection. */
@Component({
  selector: 'app-my-images',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonComponent,
    ListRowComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './my-images.component.html',
  styleUrl: './account-page.scss',
})
export class MyImagesComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly species = inject(SpeciesStore);
  private readonly store = inject(MyImagesStore);
  private readonly entries = inject(EntriesStore);
  private readonly wide = inject(ViewportService).wide;

  protected readonly back = computed(() => !this.wide());
  protected readonly loaded = this.store.loaded;
  protected readonly busy = this.store.busy;
  protected readonly more = this.store.more;

  protected readonly rows = computed<readonly Row[]>(() =>
    (this.store.photos() ?? []).map((photo) => this.row(photo)),
  );

  constructor() {
    void this.species.loadBundle();
    this.store.load();
    // A find photo takes the species of its find. The own finds are not in memory after a direct visit.
    if (this.entries.finds().length === 0) this.entries.loadOnSignIn(this.entries.signedIn);
  }

  protected next(): void {
    this.store.next();
  }

  protected open(row: Row): void {
    if (row.link !== null) void this.router.navigate(row.link);
  }

  protected toAccount(): void {
    void this.router.navigateByUrl('/konto');
  }

  private row(photo: Photo): Row {
    const state = STATE[photo.state];
    const speciesId = photo.speciesId ?? this.findSpecies(photo.findId);
    const entry = speciesId ? this.species.entryById(speciesId) : null;
    const reason = photo.state === 'rejected' && photo.rejectReason ? photo.rejectReason : null;
    const stateText =
      reason === null
        ? this.i18n.translate(state.text)
        : this.i18n.translate('image.rejectedBecause', { reason });
    const fallback = this.i18n.translate(photo.findId ? 'image.findPhoto' : 'image.untitled');
    const caption = photoCaption(photo, this.i18n.locale())?.trim() ?? '';
    return {
      id: photo.id,
      title: entry?.name ?? (caption === '' ? fallback : caption),
      sub: joined([shortDay(new Date(photo.createdAt), this.i18n), stateText]),
      thumb: photoPath(photo.id, 'list'),
      badge: this.i18n.translate(state.badge),
      kind: state.kind,
      // The image view shows only approved photos.
      link: entry && photo.state === 'approved' ? ['/arten', entry.slug, 'bilder', photo.id] : null,
    };
  }

  private findSpecies(findId: string | null | undefined): string | null {
    return findId ? (this.entries.finds().find((find) => find.id === findId)?.speciesId ?? null) : null;
  }
}
