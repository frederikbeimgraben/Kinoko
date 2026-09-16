import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PermissionsService } from '../../core/access/permissions.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { SpeciesColourChangeComponent } from './sections/species-colour-change.component';
import { SpeciesColoursComponent } from './sections/species-colours.component';
import { SpeciesFeaturesComponent } from './sections/species-features.component';
import { SpeciesHymeniumComponent } from './sections/species-hymenium.component';
import { SpeciesLookalikesComponent } from './sections/species-lookalikes.component';
import { SpeciesSensesComponent } from './sections/species-senses.component';
import { SpeciesSizeComponent } from './sections/species-size.component';
import { SpeciesLeadComponent } from './sections/species-lead.component';
import { SpeciesPhotosComponent } from './sections/species-photos.component';
import { SpeciesSeasonComponent } from './sections/species-season.component';
import { SpeciesSourcesComponent } from './sections/species-sources.component';
import { SpeciesTaxonomyComponent } from './sections/species-taxonomy.component';
import { SpeciesTimeComponent } from './sections/species-time.component';
import { ComparisonState } from './compare/comparison.state';
import { SpeciesState } from './species.state';

/** Die Artseite: Kopf, die Abschnitte des Katalogs und der Weg zur Karte. */
@Component({
  selector: 'app-species-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EmptyStateComponent,
    IconButtonComponent,
    NgTemplateOutlet,
    PageHeaderComponent,
    SpeciesColourChangeComponent,
    SpeciesColoursComponent,
    SpeciesFeaturesComponent,
    SpeciesHymeniumComponent,
    SpeciesLookalikesComponent,
    SpeciesLeadComponent,
    SpeciesPhotosComponent,
    SpeciesSeasonComponent,
    SpeciesSensesComponent,
    SpeciesSizeComponent,
    SpeciesSourcesComponent,
    SpeciesTaxonomyComponent,
    SpeciesTimeComponent,
    TranslatePipe,
  ],
  templateUrl: './species-page.component.html',
  styleUrl: './species-page.component.scss',
})
export class SpeciesPageComponent {
  private readonly state = inject(SpeciesState);
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly rights = inject(PermissionsService);
  private readonly viewport = inject(ViewportService);
  private readonly comparison = inject(ComparisonState);

  readonly slug = input.required<string>();

  protected readonly wide = this.viewport.wide;
  protected readonly species = computed(() => this.state.entryOf(this.slug()));
  protected readonly waiting = computed(() => this.state.loading());
  protected readonly title = computed(() => this.species()?.name ?? '');
  /** Wer Profile ändern darf, kommt aus dem Kopf in den Bearbeiten-Modus. */
  protected readonly mayEdit = computed(() => this.rights.can('species.edit'));

  constructor() {
    void this.state.loadBundle();
  }

  protected edit(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  protected back(): void {
    this.location.back();
  }

  protected toList(): void {
    void this.router.navigateByUrl('/arten');
  }

  protected open(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  protected compare(slug: string): void {
    this.comparison.add(this.slug());
    this.comparison.add(slug);
    void this.router.navigateByUrl('/arten/vergleich');
  }
}
