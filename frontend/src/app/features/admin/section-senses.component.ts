import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { TermRef } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { TermsState } from './terms.state';
import { SpeciesEditorState } from './species-editor.state';

/** Welcher Sinn die Seite trägt. */
type Sense = 'smell' | 'taste';

/** Ein Sinn einer Art: seine Kategorien und ein Satz dazu. */
@Component({
  selector: 'app-section-senses',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, ChipGroupComponent, FormFieldComponent, PageHeaderComponent, TranslatePipe],
  templateUrl: './section-senses.component.html',
  styleUrl: './section-senses.component.scss',
})
export class SectionSensesComponent {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);
  private readonly terms = inject(TermsState);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly slug = computed(() => this.params().get('slug') ?? '');
  protected readonly sense = computed<Sense>(() =>
    this.params().get('sense') === 'geschmack' ? 'taste' : 'smell',
  );

  protected readonly chosen = signal<readonly string[]>([]);
  protected readonly note = signal('');

  protected readonly title = computed(() =>
    this.i18n.translate(this.sense() === 'taste' ? 'species.field.taste' : 'species.field.smell'),
  );

  protected readonly chips = computed<Chip[]>(() =>
    this.terms.forKind(this.sense()).map((term) => ({ value: term.id, label: term.name })),
  );

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
    this.terms.load();
    effect(() => {
      const species = this.state.species();
      if (species === null) return;
      this.chosen.set(this.termsOf(species.terms).map((one) => one.term.id));
      this.note.set((this.sense() === 'taste' ? species.tasteText : species.smellText) ?? '');
    });
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
