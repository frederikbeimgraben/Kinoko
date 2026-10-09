import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { DEFAULT_LOCALE } from '../../core/i18n/translations';
import { HistoryService } from '../../core/navigation/history.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SpeciesPickerComponent } from '../../ui/species-picker/species-picker.component';
import { SpeciesStore } from '../species/species.store';
import { speciesPickerEntry } from '../species/species-picker-entry';
import { SpeciesEditorStore } from './species-editor.store';
import { withLookalike, withoutLookalike } from './species-lists';

/** A lookalike of a species: the other species and the difference. */
@Component({
  selector: 'app-section-lookalike',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    FormFieldComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    SectionComponent,
    SpeciesPickerComponent,
    TranslatePipe,
  ],
  templateUrl: './section-lookalike.component.html',
  styleUrl: './section-lookalike.component.scss',
})
export class SectionLookalikeComponent {
  private readonly i18n = inject(I18nService);
  private readonly history = inject(HistoryService);
  private readonly state = inject(SpeciesEditorStore);
  private readonly catalogue = inject(SpeciesStore);

  protected readonly slug = injectRouteParam('slug');
  private readonly index = injectRouteParam('index', '0');
  protected readonly at = computed(() => Number(this.index()));

  private readonly held = computed(() => this.state.species()?.lookalikes[this.at()] ?? null);
  /** Only a stored lookalike can be removed. A new one has nothing to remove. */
  protected readonly known = computed(() => this.held() !== null);

  protected readonly other = linkedSignal(() => this.held()?.slug ?? '');
  protected readonly difference = linkedSignal(() => this.held()?.difference ?? '');
  protected readonly picking = signal(false);

  protected readonly choices = computed(() =>
    this.catalogue.species().map((entry) => speciesPickerEntry(entry, this.i18n)),
  );

  /** The chosen species: name and scientific name. Without a choice, the row asks for one. */
  protected readonly otherNames = computed(() => {
    const slug = this.other();
    const held = this.held();
    // In another language than German, the name is the scientific name: it then shows only once.
    const named = (name: string, latin: string) => ({ name, latin: latin === name ? '' : latin });
    if (held?.slug === slug) return named(this.localName(held), held.scientificName);
    const found = this.catalogue.species().find((one) => one.slug === slug);
    return found === undefined
      ? named(this.i18n.translate('admin.lookalike.choose'), '')
      : named(found.name, found.scientificName);
  });

  private localName(held: { name: string; scientificName: string }): string {
    return this.i18n.locale() === DEFAULT_LOCALE ? held.name : held.scientificName;
  }

  constructor() {
    this.state.load(this.slug);
    void this.catalogue.loadBundle();
  }

  protected choose(slug: string): void {
    this.other.set(slug);
    this.picking.set(false);
  }

  protected apply(): void {
    if (this.other() === '') return;
    this.state.save({
      lookalikes: withLookalike(this.state.species(), this.at(), {
        slug: this.other(),
        difference: this.difference(),
      }),
    });
    this.back();
  }

  protected remove(): void {
    this.state.save({ lookalikes: withoutLookalike(this.state.species(), this.at()) });
    this.back();
  }

  /** Goes back to the page that opened this editor, for example the part page. */
  protected back(): void {
    this.history.back(['/verwaltung/arten', this.slug()]);
  }
}
