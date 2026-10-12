import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import type { SpeciesEntry } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { HistoryService } from '../../core/navigation/history.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SectionComponent } from '../../ui/section/section.component';
import { TermsStore } from './terms.store';
import { SpeciesEditorStore } from './species-editor.store';
import { termLabel } from './term-label';

type TermEntry = SpeciesEntry['terms'][number];

/** The tree terms of the species: the chosen trees and those that come from own experience. */
export function withTrees(
  held: readonly TermEntry[],
  trees: readonly TermEntry['term'][],
  experience: ReadonlySet<string>,
): TermEntry[] {
  const others = held.filter((one) => one.term.kind !== 'tree');
  return [...others, ...trees.map((term) => ({ term, fromExperience: experience.has(term.id) }))];
}

/** The partner trees of a species. A tree can come from own experience instead of a source. */
@Component({
  selector: 'app-section-trees',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, ChipGroupComponent, PageHeaderComponent, SectionComponent, TranslatePipe],
  templateUrl: './section-trees.component.html',
  styleUrl: './section-trees.component.scss',
})
export class SectionTreesComponent {
  private readonly i18n = inject(I18nService);
  private readonly history = inject(HistoryService);
  private readonly state = inject(SpeciesEditorStore);
  private readonly terms = inject(TermsStore);

  protected readonly slug = injectRouteParam('slug');

  private readonly held = computed(() =>
    (this.state.species()?.terms ?? []).filter((one) => one.term.kind === 'tree'),
  );
  protected readonly chosen = linkedSignal<readonly string[]>(() => this.held().map((one) => one.term.id));
  protected readonly experience = linkedSignal<readonly string[]>(() =>
    this.held()
      .filter((one) => one.fromExperience)
      .map((one) => one.term.id),
  );

  protected readonly chips = computed<Chip[]>(() =>
    this.terms.forKind('tree').map((term) => ({ value: term.id, label: termLabel(term, this.i18n) })),
  );

  /** Only a chosen tree can come from experience. */
  protected readonly chosenChips = computed<Chip[]>(() => {
    const chosen = new Set(this.chosen());
    return this.chips().filter((one) => chosen.has(one.value));
  });

  constructor() {
    this.state.load(this.slug);
    this.terms.load();
  }

  protected choose(ids: readonly string[]): void {
    this.chosen.set(ids);
    this.experience.update((held) => held.filter((id) => ids.includes(id)));
  }

  protected apply(): void {
    const species = this.state.species();
    if (species === null) return;
    const known = this.terms.forKind('tree');
    const trees = this.chosen().map((id): TermEntry['term'] => {
      const term = known.find((one) => one.id === id);
      if (term !== undefined) return { id, kind: 'tree', name: term.name, slug: term.slug };
      return this.held().find((one) => one.term.id === id)?.term ?? { id, kind: 'tree', name: '', slug: '' };
    });
    this.state.save({ terms: withTrees(species.terms, trees, new Set(this.experience())) });
    this.back();
  }

  protected back(): void {
    this.history.back(['/verwaltung/arten', this.slug()]);
  }
}
