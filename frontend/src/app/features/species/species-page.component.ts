import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Location, NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { FilterChipComponent } from '../../ui/filter-chip/filter-chip.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PopoverComponent, type PopoverAnchor } from '../../ui/popover/popover.component';
import { PopoverItemComponent } from '../../ui/popover/popover-item.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SplitLayoutComponent } from '../../ui/split-layout/split-layout.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { SurfaceComponent } from '../../ui/surface/surface.component';
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
import { SpeciesSourcesComponent } from './sections/species-sources.component';
import { SpeciesTaxonomyComponent } from './sections/species-taxonomy.component';
import { SpeciesTimeComponent } from './sections/species-time.component';
import { SpeciesTraitsComponent } from './sections/species-traits.component';
import { ComparisonState } from './compare/comparison.state';
import { SpeciesState } from './species.state';

const PHONE_MENU_ANCHOR: PopoverAnchor = { top: 60, end: 8 };
const DESKTOP_MENU_ANCHOR: PopoverAnchor = { top: 64, end: 12 };

/** Die Artseite: Kopf, das Menü, die Abschnitte des Katalogs und der Weg zur Karte. */
@Component({
  selector: 'app-species-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FilterChipComponent,
    IconButtonComponent,
    NgTemplateOutlet,
    PageHeaderComponent,
    PopoverComponent,
    PopoverItemComponent,
    ScrollFadeDirective,
    SplitLayoutComponent,
    SpeciesColourChangeComponent,
    SpeciesColoursComponent,
    SpeciesFeaturesComponent,
    SpeciesHymeniumComponent,
    SpeciesLookalikesComponent,
    SpeciesLeadComponent,
    SpeciesPhotosComponent,
    SpeciesSensesComponent,
    SpeciesSizeComponent,
    SpeciesSourcesComponent,
    SpeciesTaxonomyComponent,
    SpeciesTimeComponent,
    SpeciesTraitsComponent,
    StateViewComponent,
    SurfaceComponent,
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
  private readonly auth = inject(AuthService);

  readonly slug = input.required<string>();

  protected readonly wide = this.viewport.wide;
  protected readonly species = computed(() => this.state.entryOf(this.slug()));
  protected readonly waiting = computed(() => this.state.loading());
  protected readonly title = computed(() => this.species()?.name ?? '');
  /** Wer Profile ändern darf, kommt aus dem Kopf in den Bearbeiten-Modus. */
  protected readonly mayEdit = computed(() => this.rights.can('species.edit'));
  protected readonly canSubmitImage = this.auth.signedIn;

  protected readonly menuOpen = signal(false);
  protected readonly menuAnchor = computed<PopoverAnchor>(() =>
    this.wide() ? DESKTOP_MENU_ANCHOR : PHONE_MENU_ANCHOR,
  );

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

  protected compareSelf(): void {
    this.menuOpen.set(false);
    this.comparison.set([this.slug()]);
    void this.router.navigateByUrl('/arten/vergleich');
  }

  protected share(): void {
    this.menuOpen.set(false);
    void navigator.clipboard.writeText(`${location.origin}/arten/${this.slug()}`);
  }

  protected submitImage(): void {
    this.menuOpen.set(false);
    void this.router.navigate(['/arten', this.slug(), 'bilder', 'neu']);
  }
}
