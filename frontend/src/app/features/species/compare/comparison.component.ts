import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { from, mergeMap } from 'rxjs';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { I18nService } from '../../../core/i18n/i18n.service';
import { DEFAULT_LOCALE } from '../../../core/i18n/translations';
import { HistoryService } from '../../../core/navigation/history.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ViewportService } from '../../../core/layout/viewport.service';
import type { ColourMode, ColourValue } from '../../../ui/colour-field/colour-field.component';
import { IconButtonComponent } from '../../../ui/icon-button/icon-button.component';
import { LevelPillComponent } from '../../../ui/level-pill/level-pill.component';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { PopoverComponent, type PopoverAnchor } from '../../../ui/popover/popover.component';
import { PopoverItemComponent } from '../../../ui/popover/popover-item.component';
import { PrivateImageComponent } from '../../../ui/private-image/private-image.component';
import { ScrollFadeDirective } from '../../../ui/scroll-fade/scroll-fade.directive';
import { SkeletonComponent } from '../../../ui/skeleton/skeleton.component';
import { StateViewComponent } from '../../../ui/state-view/state-view.component';
import { SvgIconComponent } from '../../../ui/svg-icon/svg-icon.component';
import { ToastService } from '../../../ui/toast/toast.service';
import { photoPath } from '../../../core/api/models';
import { CatalogueText } from '../catalogue-text';
import { leadColour } from '../rows';
import { aliasOf } from '../species-names';
import { SpeciesDeskComponent } from '../species-desk.component';
import { SpeciesStore } from '../species.store';
import type { Group } from './comparison.cells';
import { compareGroups } from './comparison.groups';
import { CompareEntryComponent } from './compare-entry.component';
import { COMPARE_PARAM, ComparisonStore, compareQuery, compareSlugs } from './comparison.store';

const PHONE_MENU_ANCHOR: PopoverAnchor = { top: 60, end: 8 };
const DESKTOP_MENU_ANCHOR: PopoverAnchor = { top: 64, end: 12 };

/** The fill of a kit `.sw` swatch, per `Swatch.dc.html`: one colour, a range or hard stripes. */
export function swatchFill(colours: readonly ColourValue[], mode: ColourMode): string {
  const hexes = colours.map((one) => one.hex);
  if (hexes.length < 2 || mode === 'single') return hexes[0] ?? 'transparent';
  if (mode === 'gradient') return `linear-gradient(135deg, ${hexes.join(', ')})`;
  const share = 100 / hexes.length;
  const stops = hexes.map((hex, index) => `${hex} ${index * share}% ${(index + 1) * share}%`);
  return `linear-gradient(105deg, ${stops.join(', ')})`;
}

/** Two species side by side, in groups of the body, per `CompareTable.dc.html`. */
@Component({
  selector: 'app-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CompareEntryComponent,
    IconButtonComponent,
    LevelPillComponent,
    NgTemplateOutlet,
    PageHeaderComponent,
    PopoverComponent,
    PopoverItemComponent,
    PrivateImageComponent,
    ScrollFadeDirective,
    SkeletonComponent,
    SpeciesDeskComponent,
    StateViewComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './comparison.component.html',
  styleUrl: './comparison.component.scss',
})
export class ComparisonComponent {
  private readonly catalogue = inject(SpeciesStore);
  protected readonly comparison = inject(ComparisonStore);
  private readonly history = inject(HistoryService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly names = inject(CatalogueText);
  private readonly toasts = inject(ToastService);

  /** The query parameter `arten`: the slugs of the comparison, separated by a comma. */
  readonly arten = input<string>();

  protected readonly wide = inject(ViewportService).wide;
  protected readonly waiting = this.catalogue.loading;
  protected readonly menuOpen = signal(false);
  protected readonly adding = signal(false);
  protected readonly menuAnchor = computed(() => (this.wide() ? DESKTOP_MENU_ANCHOR : PHONE_MENU_ANCHOR));
  protected readonly fill = swatchFill;
  protected readonly catalogueLang = DEFAULT_LOCALE;

  protected readonly heads = computed(() =>
    this.comparison.species().map((one) => ({
      slug: one.slug,
      name: one.name,
      latin: one.scientificName,
      alias: aliasOf(one),
      image: one.leadPhotoId ? photoPath(one.leadPhotoId, 'list') : '',
      colour: leadColour(one),
    })),
  );

  protected readonly groups = computed<readonly Group[]>(() =>
    compareGroups(this.comparison.species(), this.i18n, this.names, this.comparison.diffOnly(), (slug) =>
      this.catalogue.reactionsOf(slug),
    ),
  );

  constructor() {
    // The address holds the choice, so that a link and a reload show the same table.
    effect(() => {
      this.comparison.set(compareSlugs(this.arten()));
    });
    // A link can name an unknown species or more than two: the address then names only the shown species.
    effect(() => {
      if (this.catalogue.species().length === 0) return;
      const asked = this.arten() ?? '';
      const named = compareSlugs(asked, Infinity);
      const known = named.filter((slug) => this.catalogue.entryOf(slug) !== null);
      const query = compareQuery(known);
      if (query[COMPARE_PARAM] === asked) return;
      if (known.length < named.length) {
        this.toasts.show(this.i18n.translate('species.compare.unknown'));
      }
      void this.router.navigate([], { queryParams: query, replaceUrl: true });
    });
    void this.catalogue.loadBundle();
    // The reactions are only in the profile: each shown species loads it one time.
    this.catalogue.loadProfile(
      toObservable(this.comparison.species).pipe(mergeMap((species) => from(species.map((one) => one.slug)))),
    );
  }

  /** A comparison from a link goes back to its first species. */
  protected back(): void {
    const first = this.comparison.slugs().at(0);
    this.history.back(first === undefined ? ['/arten'] : ['/arten', first]);
  }

  protected open(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  /** The second species comes from the same sheet as on the species page. */
  protected add(slug: string): void {
    this.adding.set(false);
    const first = this.comparison.slugs().at(0);
    void this.router.navigate([], {
      queryParams: compareQuery(first ? [first, slug] : [slug]),
      replaceUrl: true,
    });
  }

  protected toList(): void {
    void this.router.navigateByUrl('/arten');
  }

  protected toggleDiffOnly(): void {
    this.comparison.setDiffOnly(!this.comparison.diffOnly());
    this.menuOpen.set(false);
  }
}
