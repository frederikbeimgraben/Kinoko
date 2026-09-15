import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';
import { RejectDialogComponent } from '../../ui/reject-dialog/reject-dialog.component';
import { ReviewQueueComponent } from '../../ui/review-queue/review-queue.component';
import { SpeciesState } from '../species/species.state';
import type { Photo } from '../../core/api/models';
import { ImagesState } from './images.state';
import { reviewCard, type ReviewCard } from './review-card';

/** Der Prüfstapel: rechts wischen gibt frei, links fragt nach dem Grund. */
@Component({
  selector: 'app-image-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    RejectDialogComponent,
    ReviewQueueComponent,
    TranslatePipe,
  ],
  templateUrl: './image-queue.component.html',
  styleUrl: './image-queue.component.scss',
})
export class ImageQueueComponent {
  private readonly images = inject(ImagesState);
  private readonly species = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  /** Die Karte, deren Absage gerade nach einem Grund fragt. */
  protected readonly rejecting = signal<ReviewCard | null>(null);
  /** Wie viele Karten schon entschieden sind. Der Kopf zählt die laufende mit. */
  private readonly decided = signal(0);

  /** Der Stapel steht fest, sobald er gefüllt ist: eine Entscheidung darf ihn nicht kürzen. */
  private readonly held = signal<readonly Photo[]>([]);

  protected readonly cards = computed<readonly ReviewCard[]>(() =>
    this.held().map((one) => reviewCard(one, this.nameOf(one.speciesId ?? null), this.i18n)),
  );

  protected readonly counter = computed(() =>
    this.i18n.translate('common.counter', {
      done: Math.min(this.decided() + 1, this.held().length),
      total: this.held().length,
    }),
  );

  constructor() {
    void this.species.loadBundle();
    this.images.load({ state: 'submitted' });
    effect(() => {
      const photos = this.images.photos();
      if (photos.length === 0 || untracked(() => this.held().length) > 0) return;
      this.held.set(photos);
    });
  }

  protected accept(card: ReviewCard): void {
    this.decided.update((count) => count + 1);
    void this.images.approve(card.id);
  }

  protected ask(card: ReviewCard): void {
    this.rejecting.set(card);
  }

  protected reject(reason: string): void {
    const card = this.rejecting();
    this.rejecting.set(null);
    if (card === null) return;
    this.decided.update((count) => count + 1);
    void this.images.reject(card.id, reason);
  }

  protected undo(): void {
    this.decided.update((count) => Math.max(0, count - 1));
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung']);
  }

  private nameOf(speciesId: string | null): string {
    const found = this.species.species().find((entry) => entry.id === speciesId);
    return found?.name ?? '';
  }
}
