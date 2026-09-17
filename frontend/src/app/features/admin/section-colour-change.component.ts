import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import type { ColourChange, Speed, TermRef, TriggerGroup } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { ColourFieldComponent } from '../../ui/colour-field/colour-field.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { PART_TEXT, SPEED_TEXT } from '../species/labels';
import { TermsState } from './terms.state';
import { SpeciesEditorState } from './species-editor.state';
import {
  SPEEDS,
  TRIGGER_GROUPS,
  TRIGGER_GROUP_TEXT,
  changeAt,
  withChange,
} from './section-colour-change.rows';

/** Eine Verfärbung eines Teils: Auslöser, zwei Farben und die Dauer. */
@Component({
  selector: 'app-section-colour-change',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ChipGroupComponent,
    ColourFieldComponent,
    FormFieldComponent,
    PageHeaderComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './section-colour-change.component.html',
  styleUrl: './section-colour-change.component.scss',
})
export class SectionColourChangeComponent {
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorState);
  private readonly terms = inject(TermsState);

  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  protected readonly slug = computed(() => this.params().get('slug') ?? '');
  protected readonly at = computed(() => Number(this.params().get('index') ?? '0'));

  protected readonly kind = signal<TriggerGroup>('mechanical');
  protected readonly triggers = signal<readonly string[]>([]);
  protected readonly speed = signal<Speed | null>(null);

  private readonly change = computed<ColourChange | null>(() => changeAt(this.state.species(), this.at()));

  protected readonly partName = computed(() => {
    const part = this.change()?.part;
    return part === undefined ? '' : this.i18n.translate(PART_TEXT[part]);
  });

  protected readonly kinds = computed<SegmentOption[]>(() =>
    TRIGGER_GROUPS.map((one) => ({ value: one, label: this.i18n.translate(TRIGGER_GROUP_TEXT[one]) })),
  );

  protected readonly triggerChips = computed<Chip[]>(() =>
    this.terms.forKind('trigger').map((term) => ({ value: term.id, label: term.name })),
  );

  protected readonly speedChips = computed<Chip[]>(() =>
    SPEEDS.map((one) => ({ value: one, label: this.i18n.translate(SPEED_TEXT[one]) })),
  );

  protected readonly speedValue = computed<string[]>(() => {
    const held = this.speed();
    return held === null ? [] : [held];
  });

  protected readonly from = computed(() => {
    const value = this.change()?.from;
    return value === null || value === undefined ? [] : [value];
  });

  protected readonly to = computed(() => {
    const value = this.change()?.to;
    return value === undefined ? [] : [value];
  });

  protected readonly fromHex = computed(() => (this.change()?.from?.hex ?? '').toUpperCase());
  protected readonly toHex = computed(() => (this.change()?.to.hex ?? '').toUpperCase());

  constructor() {
    effect(() => {
      const slug = this.slug();
      if (slug !== '') this.state.load(slug);
    });
    this.terms.load();
    effect(() => {
      const change = this.change();
      if (change === null) return;
      this.kind.set(change.kind);
      this.triggers.set(change.triggers.map((one) => one.id));
      this.speed.set(change.speed ?? null);
    });
  }

  protected chooseKind(value: string): void {
    this.kind.set(value as TriggerGroup);
  }

  protected chooseSpeed(values: readonly string[]): void {
    this.speed.set((values[0] ?? null) as Speed | null);
  }

  protected apply(): void {
    const species = this.state.species();
    const change = this.change();
    if (species === null || change === null) return;
    const next: ColourChange = {
      ...change,
      kind: this.kind(),
      speed: this.speed(),
      triggers: this.triggers().map((id) => this.termById(id, change.triggers)),
    };
    this.state.save({ colourChanges: withChange(species, this.at(), next) });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }

  private termById(id: string, known: readonly TermRef[]): TermRef {
    const held = known.find((one) => one.id === id);
    if (held !== undefined) return held;
    const term = this.terms.forKind('trigger').find((one) => one.id === id);
    return term ?? { id, kind: 'trigger', name: '', slug: '' };
  }
}
