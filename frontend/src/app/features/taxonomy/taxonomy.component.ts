import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { TAXON_RANKS, type SpeciesSummary, type TaxonRank } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SpeciesRowComponent, type SpeciesRowSpecies } from '../../ui/species-row/species-row.component';
import { EDIBILITY_TEXT, EDIBILITY_TONE } from '../species/labels';
import { speciesRow } from '../species/rows';
import { SpeciesState } from '../species/species.state';
import { CHILDREN_TEXT, RANK_TEXT, SPECIES_OF_TEXT } from './labels';
import { TaxonomyState } from './taxonomy.state';
import { input } from '@angular/core';

/** Eine Zeile, die auf eine untergeordnete Stufe zeigt. */
interface ChildRow {
  route: string;
  name: string;
  count: string;
}

/** Eine Stufe der Einordnung: Weg von oben, Gattungen darunter, Arten daran. */
@Component({
  selector: 'app-taxonomy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, PageHeaderComponent, SpeciesRowComponent, StateViewComponent, TranslatePipe],
  templateUrl: './taxonomy.component.html',
  styleUrl: './taxonomy.component.scss',
})
export class TaxonomyComponent {
  private readonly state = inject(TaxonomyState);
  private readonly catalogue = inject(SpeciesState);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly i18n = inject(I18nService);

  readonly rank = input.required<string>();
  readonly slug = input.required<string>();

  constructor() {
    void this.catalogue.loadBundle();
    effect(() => {
      const rank = this.knownRank();
      if (rank !== null) this.state.load(rank, this.slug());
    });
  }

  /** Der Trenner im Weg trägt Leerraum, damit die Zeile dort umbrechen darf. */
  protected readonly arrow = ' \u203a ';

  protected readonly page = computed(() => {
    const rank = this.knownRank();
    return rank === null ? null : this.state.pageOf(rank, this.slug());
  });

  protected readonly unknown = computed(() => {
    const rank = this.knownRank();
    return rank === null || this.state.isUnknown(rank, this.slug());
  });

  protected readonly title = computed(() => {
    const held = this.page();
    return held === null ? '' : `${this.i18n.translate(RANK_TEXT[held.rank])} ${held.name}`;
  });

  protected readonly trail = computed<string[]>(() => {
    const held = this.page();
    if (held === null) return [];
    const steps = held.path.some((step) => step.slug === held.slug) ? held.path : [...held.path, held];
    return steps.map((step) => `${this.i18n.translate(RANK_TEXT[step.rank])} ${step.name}`);
  });

  protected readonly childrenTitle = computed(() => {
    const first = this.page()?.children[0];
    return first === undefined ? '' : this.i18n.translate(CHILDREN_TEXT[first.rank]);
  });

  protected readonly speciesTitle = computed(() => {
    const held = this.page();
    return held === null ? '' : this.i18n.translate(SPECIES_OF_TEXT[held.rank]);
  });

  protected readonly children = computed<ChildRow[]>(() =>
    (this.page()?.children ?? []).map((child) => ({
      route: `/taxonomie/${child.rank}/${child.slug}`,
      name: child.name,
      count: this.countText(child.speciesCount),
    })),
  );

  protected readonly species = computed(() =>
    (this.page()?.species ?? []).map((one) => ({ slug: one.slug, species: this.row(one) })),
  );

  protected back(): void {
    this.location.back();
  }

  protected toStep(route: string): void {
    void this.router.navigateByUrl(route);
  }

  protected toSpecies(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  private knownRank(): TaxonRank | null {
    const asked = this.rank();
    return TAXON_RANKS.find((known) => known === asked) ?? null;
  }

  private countText(count: number): string {
    const key = count === 1 ? 'species.taxonomy.oneSpecies' : 'species.taxonomy.speciesCount';
    return this.i18n.translate(key, { anzahl: String(count) });
  }

  /** Die Töne der Zeile stehen im lokalen Katalog, nicht in der Stufe. */
  private row(one: SpeciesSummary): SpeciesRowSpecies {
    const local = this.catalogue.entryOf(one.slug);
    if (local !== null) return speciesRow(local, this.i18n);
    const tone = EDIBILITY_TONE[one.edibility];
    return {
      name: one.name,
      latin: one.scientificName,
      levelText: this.i18n.translate(EDIBILITY_TEXT[one.edibility]),
      levelColour: tone.colour,
      levelBackground: tone.background,
    };
  }
}
