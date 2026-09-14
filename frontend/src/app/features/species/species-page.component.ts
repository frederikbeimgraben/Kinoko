import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location } from '@angular/common';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SpeciesDetailComponent } from './species-detail.component';
import { SpeciesState } from './species.state';

/** Die Artseite am Telefon: Kopf mit Zurück und die strukturierten Daten. */
@Component({
  selector: 'app-species-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, SpeciesDetailComponent],
  templateUrl: './species-page.component.html',
  styleUrl: './species-page.component.scss',
})
export class SpeciesPageComponent {
  private readonly state = inject(SpeciesState);
  private readonly location = inject(Location);

  readonly slug = input.required<string>();

  protected readonly title = computed(() => this.state.nameOf(this.slug()) ?? '');

  constructor() {
    void this.state.loadBundle();
  }

  protected back(): void {
    this.location.back();
  }
}
