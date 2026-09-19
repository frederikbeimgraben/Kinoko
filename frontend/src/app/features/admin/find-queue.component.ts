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
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { OpenFind } from '../../core/api/models';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';
import { ReviewQueueComponent } from '../../ui/review-queue/review-queue.component';
import { SpeciesState } from '../species/species.state';
import { findCard, type FindCard } from './find-card';
import { FindQueueState } from './find-queue.state';

/** Der Prüfstapel der Funde: rechts wischen nimmt an, links lehnt ab. */
@Component({
  selector: 'app-find-queue',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ConfirmDialogComponent,
    EmptyStateComponent,
    IconButtonComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    ReviewQueueComponent,
    TranslatePipe,
  ],
  templateUrl: './find-queue.component.html',
  styleUrl: './find-queue.component.scss',
})
export class FindQueueComponent {
  private readonly finds = inject(FindQueueState);
  private readonly species = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  /** Wie viele Karten schon entschieden sind. Der Kopf zählt die laufende mit. */
  private readonly decided = signal(0);
  /** Der Stapel steht fest, sobald er gefüllt ist: eine Entscheidung kürzt ihn nicht. */
  private readonly held = signal<readonly OpenFind[]>([]);

  protected readonly asking = signal(false);

  protected readonly cards = computed<readonly FindCard[]>(() => {
    const photos = this.finds.photos();
    return this.held().map((one) =>
      findCard(one, this.nameOf(one.speciesId), photos[one.id] ?? [], this.i18n),
    );
  });

  protected readonly counter = computed(() =>
    this.i18n.translate('common.counter', {
      done: Math.min(this.decided() + 1, this.held().length),
      total: this.held().length,
    }),
  );

  constructor() {
    void this.species.loadBundle();
    this.finds.load();
    effect(() => {
      const open = this.finds.open();
      if (open.length === 0 || untracked(() => this.held().length) > 0) return;
      this.held.set(open);
    });
    effect(() => {
      const at = this.decided();
      for (const find of this.held().slice(at, at + 2)) {
        this.finds.loadPhotos(find.id);
      }
    });
  }

  protected accept(card: FindCard): void {
    this.decided.update((count) => count + 1);
    this.finds.review(card.id, 'accepted');
  }

  protected reject(card: FindCard): void {
    this.decided.update((count) => count + 1);
    this.finds.review(card.id, 'rejected');
  }

  protected undo(): void {
    this.decided.update((count) => Math.max(0, count - 1));
  }

  protected acceptAll(): void {
    this.asking.set(false);
    this.finds.acceptAll().subscribe(() => {
      this.held.set([]);
      this.decided.set(0);
    });
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung']);
  }

  private nameOf(speciesId: string | null): string {
    return this.species.species().find((entry) => entry.id === speciesId)?.name ?? '';
  }
}
