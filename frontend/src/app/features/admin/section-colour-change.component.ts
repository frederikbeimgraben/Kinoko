import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import type { ColourChange, Speed, TermRef, TriggerGroup } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { ColourFieldComponent } from '../../ui/colour-field/colour-field.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { PART_TEXT, SPEED_TEXT } from '../species/labels';
import { TermsStore } from './terms.store';
import { SpeciesEditorStore } from './species-editor.store';
import { SPEEDS, TRIGGER_GROUPS, TRIGGER_GROUP_TEXT, changeAt } from './section-colour-change.rows';
import { withChange, withoutChange } from './species-lists';

/** A colour change of a part: the triggers, two colours and the speed. */
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
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorStore);
  private readonly terms = inject(TermsStore);

  protected readonly slug = injectRouteParam('slug');
  private readonly index = injectRouteParam('index', '0');
  protected readonly at = computed(() => Number(this.index()));

  private readonly change = computed<ColourChange | null>(() => changeAt(this.state.species(), this.at()));

  protected readonly kind = linkedSignal<TriggerGroup>(() => this.change()?.kind ?? 'mechanical');
  protected readonly triggers = linkedSignal<readonly string[]>(
    () => this.change()?.triggers.map((one) => one.id) ?? [],
  );
  protected readonly speed = linkedSignal<Speed | null>(() => this.change()?.speed ?? null);

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
    this.state.load(this.slug);
    this.terms.load();
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

  protected remove(): void {
    this.state.save({ colourChanges: withoutChange(this.state.species(), this.at()) });
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
