import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';
import { QueueCardSkeletonComponent } from '../../ui/review-queue/queue-card-skeleton.component';
import { ReviewQueueComponent } from '../../ui/review-queue/review-queue.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SpeciesStore } from '../species/species.store';
import { PersonNamesStore } from '../../core/access/person-names.store';
import { findCard, type FindCard } from './find-card';
import { FindQueueStore } from './find-queue.store';

/** The review queue of the finds: a swipe to the right accepts, a swipe to the left rejects. */
@Component({
  selector: 'app-find-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    IconButtonComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    QueueCardSkeletonComponent,
    ReviewQueueComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './find-queue.component.html',
  styleUrl: './find-queue.component.scss',
})
export class FindQueueComponent {
  private readonly store = inject(FindQueueStore);
  private readonly species = inject(SpeciesStore);
  private readonly people = inject(PersonNamesStore);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly asking = signal(false);
  protected readonly loaded = this.store.loaded;

  protected readonly cards = computed<readonly FindCard[]>(() => {
    const photos = this.store.photos();
    return (this.store.stack() ?? []).map((one) =>
      findCard(
        one,
        this.nameOf(one.speciesId),
        this.people.nameOf(one.ownerId),
        photos[one.id] ?? [],
        this.i18n,
      ),
    );
  });

  /** The head counts the card on top as one of the done cards. */
  protected readonly counter = computed(() => {
    const total = this.cards().length;
    return this.i18n.translate('common.counter', {
      done: Math.min(this.store.decided() + 1, total),
      total,
    });
  });

  constructor() {
    void this.species.loadBundle();
    this.store.load();
  }

  protected accept(card: FindCard): void {
    this.store.review({ id: card.id, decision: 'accepted' });
  }

  protected reject(card: FindCard): void {
    this.store.review({ id: card.id, decision: 'rejected' });
  }

  protected undo(): void {
    this.store.undo();
  }

  protected acceptAll(): void {
    this.asking.set(false);
    this.store.acceptAll({});
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung']);
  }

  private nameOf(speciesId: string | null): string {
    return this.species.species().find((entry) => entry.id === speciesId)?.name ?? '';
  }
}
