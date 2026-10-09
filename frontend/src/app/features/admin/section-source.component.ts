import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import type { SourceScope } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { longDate } from '../../core/i18n/dates';
import { HistoryService } from '../../core/navigation/history.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { SpeciesEditorStore } from './species-editor.store';
import { withSource, withoutSource } from './species-lists';

/** The two scopes of a source, as the contract has them. */
const SCOPES: readonly SourceScope[] = ['profile', 'further'];

const SCOPE_TEXT: Readonly<Record<SourceScope, TranslationKey>> = {
  profile: 'admin.source.scope.profile',
  further: 'admin.source.scope.further',
};

/** A source of a species: its scope, title, address and the day of the last check. */
@Component({
  selector: 'app-section-source',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    PageHeaderComponent,
    SectionComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './section-source.component.html',
  styleUrl: './section-source.component.scss',
})
export class SectionSourceComponent {
  private readonly i18n = inject(I18nService);
  private readonly history = inject(HistoryService);
  private readonly state = inject(SpeciesEditorStore);

  protected readonly slug = injectRouteParam('slug');
  private readonly index = injectRouteParam('index', '0');
  protected readonly at = computed(() => Number(this.index()));

  private readonly held = computed(() => this.state.species()?.sources[this.at()] ?? null);
  /** Only a stored source can be removed. A new one has nothing to remove. */
  protected readonly known = computed(() => this.held() !== null);

  protected readonly scope = linkedSignal<SourceScope>(() => this.held()?.scope ?? 'profile');
  protected readonly title = linkedSignal(() => this.held()?.title ?? '');
  protected readonly url = linkedSignal(() => this.held()?.url ?? '');
  protected readonly checkedOn = linkedSignal(() => this.held()?.checkedOn ?? '');

  protected readonly scopes = computed<SegmentOption[]>(() =>
    SCOPES.map((one) => ({ value: one, label: this.i18n.translate(SCOPE_TEXT[one]) })),
  );

  protected readonly checkedDay = computed(() => {
    const day = this.checkedOn();
    return day === '' ? '' : longDate(day, this.i18n.locale());
  });

  constructor() {
    this.state.load(this.slug);
  }

  protected chooseScope(value: string): void {
    this.scope.set(value as SourceScope);
  }

  protected apply(): void {
    this.state.save({
      sources: withSource(this.state.species(), this.at(), {
        scope: this.scope(),
        title: this.title(),
        url: this.url(),
        checkedOn: this.checkedOn(),
      }),
    });
    this.back();
  }

  protected remove(): void {
    this.state.save({ sources: withoutSource(this.state.species(), this.at()) });
    this.back();
  }

  /** Goes back to the page that opened this editor, for example the part page. */
  protected back(): void {
    this.history.back(['/verwaltung/arten', this.slug()]);
  }
}
