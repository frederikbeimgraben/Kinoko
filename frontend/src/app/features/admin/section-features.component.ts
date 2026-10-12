import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { CAP_FEATURES, CAP_MARGINS, CAP_SHAPES, STEM_FEATURES, type CapShape } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { HistoryService } from '../../core/navigation/history.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SectionComponent } from '../../ui/section/section.component';
import { CAP_SHAPE_TEXT, PART_TEXT, STEM_FEATURE_TEXT } from '../species/labels';
import { SpeciesEditorStore } from './species-editor.store';
import { chosen, enumKey } from './section-basics.rows';
import { inPhase, phaseEntries } from './section-features.rows';

/** A field of the page: its key in the values, its title, its chips and whether many values fit. */
type FieldKey = 'shapeYoung' | 'shapeOld' | 'featuresYoung' | 'featuresOld' | 'marginYoung' | 'marginOld';

interface FeatureField {
  key: FieldKey;
  title: string;
  chips: Chip[];
  value: readonly string[];
  multiple: boolean;
}

const TITLE: Readonly<Record<FieldKey, TranslationKey>> = {
  shapeYoung: 'admin.features.shapeYoung',
  shapeOld: 'admin.features.shapeOld',
  featuresYoung: 'admin.features.featuresYoung',
  featuresOld: 'admin.features.featuresOld',
  marginYoung: 'admin.features.marginYoung',
  marginOld: 'admin.features.marginOld',
};

const CAP_FIELDS: readonly FieldKey[] = [
  'shapeYoung',
  'shapeOld',
  'featuresYoung',
  'featuresOld',
  'marginYoung',
  'marginOld',
];
const STEM_FIELDS: readonly FieldKey[] = ['featuresYoung', 'featuresOld'];

/** The shape and the features of the cap or of the stem, young and old. */
@Component({
  selector: 'app-section-features',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, ChipGroupComponent, PageHeaderComponent, SectionComponent, TranslatePipe],
  templateUrl: './section-features.component.html',
  styleUrl: './section-features.component.scss',
})
export class SectionFeaturesComponent {
  private readonly i18n = inject(I18nService);
  private readonly history = inject(HistoryService);
  private readonly state = inject(SpeciesEditorStore);

  protected readonly slug = injectRouteParam('slug');
  private readonly partParam = injectRouteParam('part', 'cap');
  private readonly stem = computed(() => this.partParam() === 'stem');

  protected readonly title = computed(
    () =>
      `${this.i18n.translate(PART_TEXT[this.stem() ? 'stem' : 'cap'])}: ${this.i18n.translate('admin.features.title')}`,
  );

  private readonly values = linkedSignal<Readonly<Record<FieldKey, readonly string[]>>>(() => {
    const species = this.state.species();
    const features = this.stem()
      ? (species?.stemFeatures ?? []).map((one) => ({ value: one.feature, phase: one.phase }))
      : (species?.capFeatures ?? []).map((one) => ({ value: one.feature, phase: one.phase }));
    const margins = (species?.capMargins ?? []).map((one) => ({ value: one.margin, phase: one.phase }));
    return {
      shapeYoung: chosen(species?.capShapeYoung),
      shapeOld: chosen(species?.capShapeOld),
      featuresYoung: inPhase(features, 'young'),
      featuresOld: inPhase(features, 'old'),
      marginYoung: inPhase(margins, 'young'),
      marginOld: inPhase(margins, 'old'),
    };
  });

  protected readonly fields = computed<FeatureField[]>(() =>
    (this.stem() ? STEM_FIELDS : CAP_FIELDS).map((key) => ({
      key,
      title: this.i18n.translate(TITLE[key]),
      chips: this.chipsOf(key),
      value: this.values()[key],
      multiple: !key.startsWith('shape'),
    })),
  );

  constructor() {
    this.state.load(this.slug);
  }

  protected choose(key: FieldKey, values: readonly string[]): void {
    this.values.update((held) => ({ ...held, [key]: values }));
  }

  protected apply(): void {
    const v = this.values();
    if (this.stem()) {
      const entries = phaseEntries(STEM_FEATURES, v.featuresYoung, v.featuresOld);
      this.state.save({ stemFeatures: entries.map((one) => ({ feature: one.value, phase: one.phase })) });
    } else {
      const features = phaseEntries(CAP_FEATURES, v.featuresYoung, v.featuresOld);
      const margins = phaseEntries(CAP_MARGINS, v.marginYoung, v.marginOld);
      this.state.save({
        capShapeYoung: (v.shapeYoung[0] ?? null) as CapShape | null,
        capShapeOld: (v.shapeOld[0] ?? null) as CapShape | null,
        capFeatures: features.map((one) => ({ feature: one.value, phase: one.phase })),
        capMargins: margins.map((one) => ({ margin: one.value, phase: one.phase })),
      });
    }
    this.back();
  }

  protected back(): void {
    this.history.back(['/verwaltung/arten', this.slug(), 'teil', this.stem() ? 'stem' : 'cap']);
  }

  private chipsOf(key: FieldKey): Chip[] {
    const label = (text: TranslationKey) => this.i18n.translate(text);
    if (key.startsWith('shape')) {
      return CAP_SHAPES.map((value) => ({ value, label: label(CAP_SHAPE_TEXT[value]) }));
    }
    if (key.startsWith('margin')) {
      return CAP_MARGINS.map((value) => ({ value, label: label(enumKey('cap_margin', value)) }));
    }
    return this.stem()
      ? STEM_FEATURES.map((value) => ({ value, label: label(STEM_FEATURE_TEXT[value]) }))
      : CAP_FEATURES.map((value) => ({ value, label: label(enumKey('cap_feature', value)) }));
  }
}
