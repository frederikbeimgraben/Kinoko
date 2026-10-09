import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { HistoryService } from '../../core/navigation/history.service';
import { SharedElementDirective } from '../../core/navigation/shared-element';
import { FilterChipComponent } from '../../ui/filter-chip/filter-chip.component';
import { IconButtonComponent } from '../../ui/icon-button/icon-button.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PopoverComponent, type PopoverAnchor } from '../../ui/popover/popover.component';
import { PopoverItemComponent } from '../../ui/popover/popover-item.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SpeciesPageSkeletonComponent } from '../../ui/skeleton/species-page-skeleton.component';
import { SplitLayoutComponent } from '../../ui/split-layout/split-layout.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { PermissionsStore } from '../../core/access/permissions.store';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { SpeciesColoursComponent } from './sections/species-colours.component';
import { SpeciesFeaturesComponent } from './sections/species-features.component';
import { SpeciesHymeniumComponent } from './sections/species-hymenium.component';
import { SpeciesLookalikesComponent } from './sections/species-lookalikes.component';
import { SpeciesReactionsComponent } from './sections/species-reactions.component';
import { SpeciesSensesComponent } from './sections/species-senses.component';
import { SpeciesSizeComponent } from './sections/species-size.component';
import { SpeciesLeadComponent } from './sections/species-lead.component';
import { SpeciesPhotosComponent } from './sections/species-photos.component';
import { SpeciesSourcesComponent } from './sections/species-sources.component';
import { SpeciesTaxonomyComponent } from './sections/species-taxonomy.component';
import { SpeciesTimeComponent } from './sections/species-time.component';
import { SpeciesTraitsComponent } from './sections/species-traits.component';
import { CompareEntryComponent } from './compare/compare-entry.component';
import { compareQuery } from './compare/comparison.store';
import { SpeciesDeskComponent } from './species-desk.component';
import { SpeciesStore } from './species.store';

const PHONE_MENU_ANCHOR: PopoverAnchor = { top: 60, end: 8 };
const DESKTOP_MENU_ANCHOR: PopoverAnchor = { top: 64, end: 12 };

/** The hero heights of `SpeciesPage.dc.html` and `SpeciesDesktop.dc.html`. */
const HERO_PHONE = 260;
/** Without a photo the hero is lower, per `SpeciesPageNoPhoto.dc.html`. */
const HERO_PHONE_BARE = 220;
const HERO_DESKTOP = 210;

/** The species page: the head, the menu, the sections of the catalogue and the way to compare. */
@Component({
  selector: 'app-species-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CompareEntryComponent,
    FilterChipComponent,
    IconButtonComponent,
    NgTemplateOutlet,
    PageHeaderComponent,
    PopoverComponent,
    PopoverItemComponent,
    ScrollFadeDirective,
    SharedElementDirective,
    SpeciesColoursComponent,
    SpeciesDeskComponent,
    SpeciesFeaturesComponent,
    SpeciesHymeniumComponent,
    SpeciesLeadComponent,
    SpeciesLookalikesComponent,
    SpeciesPageSkeletonComponent,
    SpeciesPhotosComponent,
    SpeciesReactionsComponent,
    SpeciesSensesComponent,
    SpeciesSizeComponent,
    SpeciesSourcesComponent,
    SpeciesTaxonomyComponent,
    SpeciesTimeComponent,
    SpeciesTraitsComponent,
    SplitLayoutComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './species-page.component.html',
  styleUrl: './species-page.component.scss',
})
export class SpeciesPageComponent {
  private readonly catalogue = inject(SpeciesStore);
  private readonly history = inject(HistoryService);
  private readonly router = inject(Router);
  private readonly rights = inject(PermissionsStore);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly slug = input.required<string>();

  protected readonly wide = inject(ViewportService).wide;
  protected readonly species = computed(() => this.catalogue.entryOf(this.slug()));
  protected readonly reactions = computed(() => this.catalogue.reactionsOf(this.slug()));
  protected readonly waiting = this.catalogue.loading;
  /** The common names besides the main name. The latin synonyms stay in the search only. */
  protected readonly otherNames = computed(() => {
    const names = (this.species()?.names ?? [])
      .filter((one) => one.kind === 'common' && one.name !== this.species()?.name)
      .map((one) => one.name);
    return names.length === 0 ? '' : this.i18n.translate('species.otherNames', { names: names.join(', ') });
  });
  protected readonly heroHeight = computed(() => {
    if (this.wide()) return HERO_DESKTOP;
    return this.species()?.leadPhotoId ? HERO_PHONE : HERO_PHONE_BARE;
  });
  /** A person who may change profiles goes from the head into the editor. */
  protected readonly mayEdit = computed(() => this.rights.can('species.edit'));
  protected readonly canSubmitImage = this.auth.signedIn;
  /** A person who reviews photos adds a photo directly. The menu names it as the form does. */
  protected readonly curatesImages = computed(() => this.rights.can('image.review'));

  protected readonly menuOpen = signal(false);
  protected readonly compareOpen = signal(false);
  protected readonly menuAnchor = computed<PopoverAnchor>(() =>
    this.wide() ? DESKTOP_MENU_ANCHOR : PHONE_MENU_ANCHOR,
  );

  constructor() {
    void this.catalogue.loadBundle();
    this.catalogue.loadProfile(this.slug);
  }

  protected edit(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  protected back(): void {
    this.history.back(['/arten']);
  }

  protected toList(): void {
    void this.router.navigateByUrl('/arten');
  }

  protected open(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  /** The comparison has its species in the address, so that a link or a reload shows the same table. */
  protected compare(slug: string): void {
    this.compareOpen.set(false);
    void this.router.navigate(['/arten/vergleich'], { queryParams: compareQuery([this.slug(), slug]) });
  }

  protected compareSelf(): void {
    this.menuOpen.set(false);
    this.compareOpen.set(true);
  }

  protected openFromSheet(slug: string): void {
    this.compareOpen.set(false);
    this.open(slug);
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
