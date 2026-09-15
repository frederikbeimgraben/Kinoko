import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { AccountService } from '../../core/access/account.service';
import { PermissionsService } from '../../core/access/permissions.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ImageViewerComponent } from '../../ui/image-viewer/image-viewer.component';
import { SpeciesState } from '../species/species.state';
import { ImagesState } from './images.state';

/** Ein Bild groß mit seinen Angaben und den beiden Wegen am Fuß. */
@Component({
  selector: 'app-image-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, ImageViewerComponent, TranslatePipe],
  templateUrl: './image-view.component.html',
  styleUrl: './image-view.component.scss',
})
export class ImageViewComponent {
  private readonly images = inject(ImagesState);
  private readonly species = inject(SpeciesState);
  private readonly router = inject(Router);
  private readonly rights = inject(PermissionsService);
  private readonly account = inject(AccountService);

  readonly slug = input.required<string>();
  readonly id = input.required<string>();

  protected readonly title = computed(() => this.species.nameOf(this.slug()) ?? this.slug());
  protected readonly photo = computed(() => this.images.photoOf(this.id()));
  protected readonly index = computed(() => this.images.positionOf(this.id()));
  protected readonly count = computed(() => this.images.photos().length);

  /** Das Titelbild setzt nur, wer Bilder prüft. */
  protected readonly canSetLead = computed(() => this.rights.can('image.review'));
  /** Entfernen darf, wer prüft oder das Bild eingereicht hat. */
  protected readonly canRemove = computed(
    () => this.canSetLead() || this.account.owns(this.photo()?.ownerId ?? null),
  );

  constructor() {
    void this.species.loadBundle();
    effect(() => {
      const speciesId = this.species.entryOf(this.slug())?.id;
      if (speciesId !== undefined && this.images.photos().length === 0) {
        this.images.load({ speciesId, state: 'approved' });
      }
    });
  }

  protected back(): void {
    void this.router.navigate(['/arten', this.slug()]);
  }

  protected async setCover(): Promise<void> {
    await this.images.setLead(this.id());
  }

  protected async remove(): Promise<void> {
    await this.images.remove(this.id());
    this.back();
  }
}
