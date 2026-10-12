import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  EDIBILITIES,
  FREQUENCIES,
  PROTECTIONS,
  RED_LIST_STATUSES,
  type Edibility,
  type Frequency,
  type Group,
  type Protection,
  type RedListStatus,
} from '../../core/api/models';
import { TaxaApi } from '../../core/api/taxa.api';
import { I18nService } from '../../core/i18n/i18n.service';
import { HistoryService } from '../../core/navigation/history.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { CheckRowComponent } from '../../ui/check-row/check-row.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { GROUP_NAME_TEXT, PROTECTION_TEXT } from '../species/labels';
import { EDIBILITY_SHORT_TEXT } from './labels';
import { SpeciesEditorStore } from './species-editor.store';
import { chosen, enumKey, namesFrom, namesLine } from './section-basics.rows';

/** The choices of the sheet. */
type Picker = 'group' | 'taxon' | 'protection';

const PICKER_TITLE: Readonly<Record<Picker, TranslationKey>> = {
  group: 'admin.species.field.group',
  taxon: 'species.taxonomy.genus',
  protection: 'species.field.protection',
};

/** The option of the sheet for a species without a genus. */
const NO_TAXON = 'keine';

/** Name, other names, classification, protection and status of a species, as one page. */
@Component({
  selector: 'app-section-basics',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CheckRowComponent,
    ChipGroupComponent,
    FormFieldComponent,
    ListRowComponent,
    OptionSheetComponent,
    PageHeaderComponent,
    RowGroupComponent,
    SectionComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './section-basics.component.html',
  styleUrl: './section-basics.component.scss',
})
export class SectionBasicsComponent {
  private readonly i18n = inject(I18nService);
  private readonly history = inject(HistoryService);
  private readonly state = inject(SpeciesEditorStore);

  protected readonly slug = injectRouteParam('slug');
  private readonly held = this.state.species;

  protected readonly name = linkedSignal(() => this.held()?.name ?? '');
  protected readonly scientificName = linkedSignal(() => this.held()?.scientificName ?? '');
  protected readonly commonNames = linkedSignal(() => namesLine(this.held(), 'common'));
  protected readonly synonyms = linkedSignal(() => namesLine(this.held(), 'synonym'));
  protected readonly group = linkedSignal<Group | null>(() => this.held()?.group ?? null);
  protected readonly edibility = linkedSignal<Edibility>(() => this.held()?.edibility ?? 'edible');
  protected readonly protection = linkedSignal<Protection>(() => this.held()?.protection ?? 'none');
  protected readonly protectionNote = linkedSignal(() => this.held()?.protectionNote ?? '');
  protected readonly redList = linkedSignal<RedListStatus | null>(() => this.held()?.redList ?? null);
  protected readonly frequency = linkedSignal<Frequency | null>(() => this.held()?.frequency ?? null);
  protected readonly marketable = linkedSignal(() => this.held()?.marketable ?? false);
  protected readonly draft = linkedSignal(() => this.held()?.descriptionDraft ?? false);
  protected readonly taxonId = linkedSignal<string | null>(() => this.held()?.taxonId ?? null);
  /** The genera to choose from. Until they load, the row names the genus of the profile. */
  private readonly genera = toSignal(inject(TaxaApi).list('genus'), { initialValue: [] });
  /** The choice that is open in the sheet. */
  protected readonly picking = signal<Picker | null>(null);

  /** A species needs a name and a latin name. */
  protected readonly complete = computed(
    () => this.name().trim() !== '' && this.scientificName().trim() !== '' && this.group() !== null,
  );

  protected readonly groupName = computed(() => {
    const group = this.group();
    return group === null ? this.i18n.translate('common.none') : this.i18n.translate(GROUP_NAME_TEXT[group]);
  });

  protected readonly genusName = computed(() => {
    const id = this.taxonId();
    if (id === null) return this.i18n.translate('common.none');
    const held = this.held();
    return this.genera().find((one) => one.id === id)?.name ?? (id === held?.taxonId ? held.genusName : id);
  });

  protected readonly protectionName = computed(() => this.i18n.translate(PROTECTION_TEXT[this.protection()]));

  protected readonly pickerTitle = computed(() =>
    this.i18n.translate(PICKER_TITLE[this.picking() ?? 'group']),
  );

  protected readonly options = computed<OptionSheetOption[]>(() => {
    const picking = this.picking();
    if (picking === 'protection') {
      return PROTECTIONS.map((id) => ({ id, title: this.i18n.translate(PROTECTION_TEXT[id]) }));
    }
    if (picking === 'taxon') {
      const none = { id: NO_TAXON, title: this.i18n.translate('common.none') };
      return [none, ...this.genera().map((one) => ({ id: one.id, title: one.name }))];
    }
    return Object.entries(GROUP_NAME_TEXT).map(([id, key]) => ({ id, title: this.i18n.translate(key) }));
  });

  protected readonly pickedValue = computed(() => {
    const picking = this.picking();
    if (picking === 'protection') return this.protection();
    if (picking === 'taxon') return this.taxonId() ?? NO_TAXON;
    return this.group();
  });

  protected readonly edibilities = computed<SegmentOption[]>(() =>
    EDIBILITIES.map((value) => ({ value, label: this.i18n.translate(EDIBILITY_SHORT_TEXT[value]) })),
  );

  protected readonly redLists = computed<Chip[]>(() => this.chips('red_list', RED_LIST_STATUSES));
  protected readonly frequencies = computed<Chip[]>(() => this.chips('frequency', FREQUENCIES));

  protected readonly redListValue = computed(() => chosen(this.redList()));
  protected readonly frequencyValue = computed(() => chosen(this.frequency()));

  constructor() {
    this.state.load(this.slug);
  }

  protected choose(id: string): void {
    const picking = this.picking();
    if (picking === 'protection') this.protection.set(id as Protection);
    else if (picking === 'taxon') this.taxonId.set(id === NO_TAXON ? null : id);
    else this.group.set(id as Group);
    this.picking.set(null);
  }

  protected chooseEdibility(value: string): void {
    this.edibility.set(value as Edibility);
  }

  protected chooseRedList(values: readonly string[]): void {
    this.redList.set((values[0] ?? null) as RedListStatus | null);
  }

  protected chooseFrequency(values: readonly string[]): void {
    this.frequency.set((values[0] ?? null) as Frequency | null);
  }

  protected apply(): void {
    const group = this.group();
    if (!this.complete() || group === null) return;
    const note = this.protectionNote().trim();
    this.state.save({
      name: this.name().trim(),
      scientificName: this.scientificName().trim(),
      names: namesFrom(this.commonNames(), this.synonyms()),
      taxonId: this.taxonId(),
      group,
      edibility: this.edibility(),
      protection: this.protection(),
      protectionNote: note === '' ? null : note,
      redList: this.redList(),
      frequency: this.frequency(),
      marketable: this.marketable(),
      descriptionDraft: this.draft(),
    });
    this.back();
  }

  protected back(): void {
    this.history.back(['/verwaltung/arten', this.slug()]);
  }

  private chips(set: string, values: readonly string[]): Chip[] {
    return values.map((value) => ({ value, label: this.i18n.translate(enumKey(set, value)) }));
  }
}
