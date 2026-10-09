import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import type { Photo, SpeciesEntry } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { ObjectTitleComponent } from '../../ui/object-title/object-title.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';
import { RejectDialogComponent } from '../../ui/reject-dialog/reject-dialog.component';
import { QueueCardSkeletonComponent } from '../../ui/review-queue/queue-card-skeleton.component';
import { ReviewQueueComponent } from '../../ui/review-queue/review-queue.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SpeciesStore } from '../species/species.store';
import { ImagesStore } from './images.store';
import { reviewCard, type ReviewCard } from './review-card';

/** The review stack of images, per the board `ImageQueue`.
 * A swipe to the right approves. A swipe to the left asks for the reason and goes on only with a reason. */
@Component({
  selector: 'app-image-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LevelPillComponent,
    ListRowComponent,
    ObjectTitleComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    QueueCardSkeletonComponent,
    RejectDialogComponent,
    ReviewQueueComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './image-queue.component.html',
  styleUrl: './image-queue.component.scss',
})
export class ImageQueueComponent {
  private readonly images = inject(ImagesStore);
  private readonly species = inject(SpeciesStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly queue = viewChild(ReviewQueueComponent);

  /** The card whose rejection asks for a reason. */
  protected readonly rejecting = signal<ReviewCard | null>(null);
  /** The count of decided cards. */
  private readonly decided = signal(0);
  /** The running decision of each card. An undo waits for it, so the reopen comes after it. */
  private readonly sent = new Map<string, Promise<void>>();

  /** The stack is fixed when the answer comes: a decision must not make it shorter. `null` while it loads. */
  private readonly held = signal<readonly Photo[] | null>(null);

  protected readonly loaded = computed(() => this.held() !== null);

  protected readonly cards = computed<readonly ReviewCard[]>(() =>
    (this.held() ?? []).map((one) => reviewCard(one, this.speciesOf(one.speciesId ?? null), this.i18n)),
  );

  /** The badge in the head: the number of images that still wait for a decision. */
  protected readonly open = computed(() => Math.max(0, this.cards().length - this.decided()));
  protected readonly openLabel = computed(() =>
    this.i18n.translate('image.queue.openCount', { count: this.open() }),
  );

  constructor() {
    void this.species.loadBundle();
    this.images.load({ state: 'submitted' });
    // Only the answer to the queue query fills the stack, not the photos of an earlier view.
    effect(() => {
      const photos = this.images.photos();
      const answered = this.images.loaded() || this.images.failed();
      if (!answered || this.images.query()?.state !== 'submitted') return;
      if (untracked(() => this.held()) === null) this.held.set(photos);
    });
  }

  protected accept(card: ReviewCard): void {
    this.decided.update((count) => count + 1);
    this.sent.set(card.id, this.images.approve(card.id));
  }

  protected ask(card: ReviewCard): void {
    this.rejecting.set(card);
  }

  /** The card goes away only after the reason. A cancel of the dialog keeps it on top. */
  protected reject(reason: string): void {
    const card = this.rejecting();
    this.rejecting.set(null);
    if (card === null) return;
    this.queue()?.advance();
    this.decided.update((count) => count + 1);
    this.sent.set(card.id, this.images.reject(card.id, reason));
  }

  protected async undo(card: ReviewCard): Promise<void> {
    this.decided.update((count) => Math.max(0, count - 1));
    await this.sent.get(card.id);
    this.sent.delete(card.id);
    await this.images.reopen(card.id);
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung']);
  }

  private speciesOf(speciesId: string | null): SpeciesEntry | null {
    return speciesId === null ? null : this.species.entryById(speciesId);
  }
}
