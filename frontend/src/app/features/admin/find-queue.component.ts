import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { SpeciesEntry } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { LevelPillComponent } from '../../ui/level-pill/level-pill.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { ObjectTitleComponent } from '../../ui/object-title/object-title.component';
import { QueueCardSkeletonComponent } from '../../ui/review-queue/queue-card-skeleton.component';
import { ReviewQueueComponent } from '../../ui/review-queue/review-queue.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SpeciesStore } from '../species/species.store';
import { findCard, type FindCard } from './find-card';
import { FindMapComponent } from './find-map.component';
import { FindQueueStore } from './find-queue.store';

/** The review queue of the finds, per the board `FindQueue`: a swipe to the right accepts, to the left rejects. */
@Component({
  selector: 'app-find-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    FindMapComponent,
    IconButtonComponent,
    LevelPillComponent,
    ListRowComponent,
    ObjectTitleComponent,
    PageHeaderComponent,
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
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly asking = signal(false);
  protected readonly loaded = this.store.loaded;

  protected readonly cards = computed<readonly FindCard[]>(() => {
    const photos = this.store.photos();
    return (this.store.stack() ?? []).map((one) =>
      findCard(one, this.speciesOf(one.speciesId), photos[one.id] ?? [], this.i18n),
    );
  });

  /** The badge in the head: the number of finds that still wait for a decision. */
  protected readonly open = computed(() => this.store.open().length);
  protected readonly openLabel = computed(() =>
    this.i18n.translate('find.queue.openCount', { count: this.open() }),
  );

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

  private speciesOf(speciesId: string | null): SpeciesEntry | null {
    return speciesId === null
      ? null
      : (this.species.species().find((entry) => entry.id === speciesId) ?? null);
  }
}
