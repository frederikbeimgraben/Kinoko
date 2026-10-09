import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { TAXON_RANKS, type SpeciesSummary, type TaxonPage, type TaxonRank } from '../../core/api/models';
import { photoPath } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { HistoryService } from '../../core/navigation/history.service';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { PrivateImageComponent } from '../../ui/private-image/private-image.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { leadColour } from '../species/rows';
import { SpeciesStore } from '../species/species.store';
import { CHILDREN_TEXT, RANK_TEXT, SPECIES_OF_TEXT } from './labels';
import { TaxonomyStore, type TaxonKey } from './taxonomy.store';

/** A row of the section "Rang": the rank and the name of one step. */
export interface RankRow {
  readonly rank: string;
  readonly name: string;
  readonly route: string;
  readonly current: boolean;
}

/** A row that points to a lower step. */
interface ChildRow {
  readonly route: string;
  readonly name: string;
  readonly count: string;
}

/** A species row with its thumb. */
interface SpeciesLine {
  readonly slug: string;
  readonly name: string;
  readonly latin: string;
  readonly image: string;
  readonly colour: string;
}

/** The steps from the top to the page itself, each with its rank text. */
export function rankRows(page: TaxonPage, rankText: (rank: TaxonRank) => string): RankRow[] {
  const steps = page.path.some((step) => step.slug === page.slug) ? page.path : [...page.path, page];
  return steps.map((step) => ({
    rank: rankText(step.rank),
    name: step.name,
    route: `/taxonomie/${step.rank}/${step.slug}`,
    current: step.slug === page.slug,
  }));
}

/** One step of the taxonomy: the ranks above, the lower steps and the species. */
@Component({
  selector: 'app-taxonomy',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ListRowComponent,
    PageHeaderComponent,
    PrivateImageComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SectionComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './taxonomy.component.html',
  styleUrl: './taxonomy.component.scss',
})
export class TaxonomyComponent {
  private readonly store = inject(TaxonomyStore);
  private readonly catalogue = inject(SpeciesStore);
  private readonly router = inject(Router);
  private readonly history = inject(HistoryService);
  private readonly i18n = inject(I18nService);

  readonly rank = input.required<string>();
  readonly slug = input.required<string>();

  private readonly knownRank = computed<TaxonRank | null>(
    () => TAXON_RANKS.find((known) => known === this.rank()) ?? null,
  );

  private readonly step = computed<TaxonKey | null>(() => {
    const rank = this.knownRank();
    return rank === null ? null : { rank, slug: this.slug() };
  });

  constructor() {
    void this.catalogue.loadBundle();
    this.store.load(this.step);
  }

  protected readonly page = computed(() => {
    const step = this.step();
    return step === null ? null : this.store.pageOf(step.rank, step.slug);
  });

  protected readonly unknown = computed(() => {
    const step = this.step();
    return step === null || this.store.isUnknown(step.rank, step.slug);
  });

  protected readonly ranks = computed<RankRow[]>(() => {
    const held = this.page();
    return held === null ? [] : rankRows(held, (rank) => this.i18n.translate(RANK_TEXT[rank]));
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

  protected readonly species = computed<SpeciesLine[]>(() =>
    (this.page()?.species ?? []).map((one) => this.line(one)),
  );

  protected back(): void {
    this.history.back(['/arten']);
  }

  protected toStep(route: string): void {
    void this.router.navigateByUrl(route);
  }

  protected toSpecies(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  private countText(count: number): string {
    const key = count === 1 ? 'species.taxonomy.oneSpecies' : 'species.taxonomy.speciesCount';
    return this.i18n.translate(key, { anzahl: String(count) });
  }

  /** The colour of the thumb is in the local catalogue, not in the step. */
  private line(one: SpeciesSummary): SpeciesLine {
    const local = this.catalogue.entryOf(one.slug);
    const photo = one.leadPhotoId ?? local?.leadPhotoId ?? null;
    return {
      slug: one.slug,
      name: one.name,
      latin: one.scientificName,
      image: photo === null ? '' : photoPath(photo, 'list'),
      colour: local === null ? '#7a5230' : leadColour(local),
    };
  }
}
