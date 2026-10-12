import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import type { TraitKey } from '../../core/api/models';
import { HistoryService } from '../../core/navigation/history.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SpeciesEditorStore } from './species-editor.store';
import { TEXT_TRAITS, withTexts } from './section-texts.rows';

/** The catalogue texts of a species that belong to no body part, for example the habitat. */
@Component({
  selector: 'app-section-texts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, FormFieldComponent, PageHeaderComponent, SectionComponent, TranslatePipe],
  templateUrl: './section-texts.component.html',
  styleUrl: './section-texts.component.scss',
})
export class SectionTextsComponent {
  private readonly history = inject(HistoryService);
  private readonly state = inject(SpeciesEditorStore);

  protected readonly slug = injectRouteParam('slug');

  private readonly texts = linkedSignal<Readonly<Record<string, string>>>(() => {
    const traits = this.state.species()?.traits ?? [];
    return Object.fromEntries(
      TEXT_TRAITS.map((one) => [one.key, traits.find((t) => t.key === one.key)?.text ?? '']),
    );
  });

  protected readonly fields = computed(() =>
    TEXT_TRAITS.map((one) => ({ key: one.key, title: one.title, text: this.texts()[one.key] ?? '' })),
  );

  constructor() {
    this.state.load(this.slug);
  }

  protected write(key: TraitKey, text: string): void {
    this.texts.update((held) => ({ ...held, [key]: text }));
  }

  protected apply(): void {
    const species = this.state.species();
    if (species === null) return;
    this.state.save({ traits: withTexts(species.traits, this.texts()) });
    this.back();
  }

  protected back(): void {
    this.history.back(['/verwaltung/arten', this.slug()]);
  }
}
