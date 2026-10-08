import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import type { TermRef } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { TermsStore } from './terms.store';
import { SpeciesEditorStore } from './species-editor.store';

/** The sense that the page edits. */
type Sense = 'smell' | 'taste';

/** One sense of a species: its categories and a sentence. */
@Component({
  selector: 'app-section-senses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, ChipGroupComponent, FormFieldComponent, PageHeaderComponent, TranslatePipe],
  templateUrl: './section-senses.component.html',
  styleUrl: './section-senses.component.scss',
})
export class SectionSensesComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorStore);
  private readonly terms = inject(TermsStore);

  protected readonly slug = injectRouteParam('slug');
  private readonly senseParam = injectRouteParam('sense');
  protected readonly sense = computed<Sense>(() => (this.senseParam() === 'geschmack' ? 'taste' : 'smell'));

  protected readonly chosen = linkedSignal<readonly string[]>(() =>
    this.termsOf(this.state.species()?.terms ?? []).map((one) => one.term.id),
  );
  protected readonly note = linkedSignal(() => {
    const species = this.state.species();
    return (this.sense() === 'taste' ? species?.tasteText : species?.smellText) ?? '';
  });

  protected readonly title = computed(() =>
    this.i18n.translate(this.sense() === 'taste' ? 'species.field.taste' : 'species.field.smell'),
  );

  protected readonly chips = computed<Chip[]>(() =>
    this.terms.forKind(this.sense()).map((term) => ({ value: term.id, label: term.name })),
  );

  constructor() {
    this.state.load(this.slug);
    this.terms.load();
  }

  protected apply(): void {
    const species = this.state.species();
    if (species === null) return;
    const others = species.terms.filter((one) => !this.isSense(one.term));
    const picked = species.terms.filter((one) => this.isSense(one.term));
    const kept = this.chosen().map((id) => {
      const known = picked.find((one) => one.term.id === id);
      return known ?? { term: this.termById(id), fromExperience: false };
    });
    const note = this.note() === '' ? null : this.note();
    this.state.save({
      terms: [...others, ...kept],
      ...(this.sense() === 'taste' ? { tasteText: note } : { smellText: note }),
    });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  private termsOf(terms: readonly { term: TermRef; fromExperience?: boolean }[]): {
    term: TermRef;
    fromExperience?: boolean;
  }[] {
    return terms.filter((one) => this.isSense(one.term));
  }

  private isSense(term: TermRef): boolean {
    return term.kind === this.sense();
  }

  private termById(id: string): TermRef {
    const known = this.terms.forKind(this.sense()).find((one) => one.id === id);
    return known ?? { id, kind: this.sense(), name: '', slug: '' };
  }
}
