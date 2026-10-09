import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import type { TermRef } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { HistoryService } from '../../core/navigation/history.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SectionComponent } from '../../ui/section/section.component';
import { TermsStore } from './terms.store';
import { SpeciesEditorStore } from './species-editor.store';
import { termLabel } from './term-label';

/** A sense of the page. */
type Sense = 'smell' | 'taste';

const SENSES: readonly Sense[] = ['smell', 'taste'];

/** A sense with its chips, its chosen terms and its sentence. */
interface SenseBlock {
  sense: Sense;
  chips: Chip[];
  chosen: readonly string[];
  note: string;
}

/** Smell and taste of a species: the categories and a sentence for each, as one page. */
@Component({
  selector: 'app-section-senses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ChipGroupComponent,
    FormFieldComponent,
    PageHeaderComponent,
    SectionComponent,
    TranslatePipe,
  ],
  templateUrl: './section-senses.component.html',
  styleUrl: './section-senses.component.scss',
})
export class SectionSensesComponent {
  private readonly i18n = inject(I18nService);
  private readonly history = inject(HistoryService);
  private readonly state = inject(SpeciesEditorStore);
  private readonly terms = inject(TermsStore);

  protected readonly slug = injectRouteParam('slug');

  private readonly chosen = linkedSignal<Readonly<Record<Sense, readonly string[]>>>(() => {
    const held = this.state.species()?.terms ?? [];
    const of = (sense: Sense): string[] =>
      held.filter((one) => one.term.kind === sense).map((one) => one.term.id);
    return { smell: of('smell'), taste: of('taste') };
  });

  private readonly notes = linkedSignal<Readonly<Record<Sense, string>>>(() => {
    const species = this.state.species();
    return { smell: species?.smellText ?? '', taste: species?.tasteText ?? '' };
  });

  protected readonly blocks = computed<SenseBlock[]>(() =>
    SENSES.map((sense) => ({
      sense,
      chips: this.terms.forKind(sense).map((term) => ({ value: term.id, label: termLabel(term, this.i18n) })),
      chosen: this.chosen()[sense],
      note: this.notes()[sense],
    })),
  );

  constructor() {
    this.state.load(this.slug);
    this.terms.load();
  }

  protected choose(sense: Sense, ids: readonly string[]): void {
    this.chosen.update((held) => ({ ...held, [sense]: ids }));
  }

  protected write(sense: Sense, note: string): void {
    this.notes.update((held) => ({ ...held, [sense]: note }));
  }

  protected title(sense: Sense): string {
    return this.i18n.translate(sense === 'taste' ? 'species.field.taste' : 'species.field.smell');
  }

  /** Keeps the other terms of the species and the flags of the terms that stay. */
  protected apply(): void {
    const species = this.state.species();
    if (species === null) return;
    const others = species.terms.filter((one) => !SENSES.some((sense) => sense === one.term.kind));
    const kept = SENSES.flatMap((sense) =>
      this.chosen()[sense].map(
        (id) =>
          species.terms.find((one) => one.term.id === id) ?? {
            term: this.termById(sense, id),
            fromExperience: false,
          },
      ),
    );
    const text = (value: string): string | null => (value.trim() === '' ? null : value);
    this.state.save({
      terms: [...others, ...kept],
      smellText: text(this.notes().smell),
      tasteText: text(this.notes().taste),
    });
    this.back();
  }

  /** Goes back to the page that opened this editor, for example the part page. */
  protected back(): void {
    this.history.back(['/verwaltung/arten', this.slug()]);
  }

  private termById(sense: Sense, id: string): TermRef {
    const known = this.terms.forKind(sense).find((one) => one.id === id);
    return known ?? { id, kind: sense, name: '', slug: '' };
  }
}
