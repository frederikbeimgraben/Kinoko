import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { photoPath } from '../../../core/api/models';
import { HeroComponent, type HeroPhoto } from '../../../ui/hero/hero.component';
import { ImagesState } from '../../images/images.state';
import { SpeciesState } from '../species.state';

/** Das Titelbild der Art, ganz oben auf der Seite. */
@Component({
  selector: 'app-species-lead',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HeroComponent],
  templateUrl: './species-lead.component.html',
  styleUrl: './species-lead.component.scss',
})
export class SpeciesLeadComponent {
  private readonly images = inject(ImagesState);
  private readonly species = inject(SpeciesState);
  private readonly router = inject(Router);

  readonly slug = input.required<string>();

  protected readonly lead = this.images.lead;

  protected readonly photo = computed<HeroPhoto | null>(() => {
    const held = this.lead();
    if (held === null) return null;
    return { path: photoPath(held.id, 'full'), photographer: held.photographer, licence: held.licence };
  });

  protected readonly alt = computed(
    () => this.lead()?.caption ?? this.species.nameOf(this.slug()) ?? this.slug(),
  );

  constructor() {
    effect(() => {
      const id = this.species.entryOf(this.slug())?.id;
      if (id !== undefined) this.images.load({ speciesId: id, state: 'approved' });
    });
  }

  protected open(): void {
    const held = this.lead();
    if (held === null) return;
    void this.router.navigate(['/arten', this.slug(), 'bilder', held.id]);
  }
}
