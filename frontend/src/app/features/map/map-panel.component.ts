import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { Rule } from '../../core/api/models';
import type { TranslationKey } from '../../core/i18n/translations';

/** Der Text zu jeder Regel. */
const RULE_KEY: Record<Rule, TranslationKey> = {
  intersection: 'map.combination.intersection',
  graded: 'map.combination.graduated',
};
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { RampComponent } from '../../ui/ramp/ramp.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import type { IconName } from '../../ui/svg-icon/svg-icon.component';
import { layerIcon } from '../../core/tiles/layer-groups';
import { CombinationComponent } from './combination.component';
import { layerTitle } from './layer-name';
import { MapView } from './map.view';
import { VIEW_MODES } from './map.state';
import { SkeletonComponent } from '../../ui/skeleton/skeleton.component';

/** Der Inhalt unter dem Kopf: Reiter, Legende, Ebene oder Kombination. */
@Component({
  selector: 'app-map-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    SkeletonComponent,
    CombinationComponent,
    FormFieldComponent,
    ListRowComponent,
    RampComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './map-panel.component.html',
  styleUrl: './map-panel.component.scss',
})
export class MapPanelComponent {
  private readonly i18n = inject(I18nService);
  protected readonly view = inject(MapView);
  protected readonly state = this.view.state;
  protected readonly combination = this.view.combination;

  readonly layerChosen = output();
  readonly savedOpened = output();
  readonly factorOpened = output<string>();
  readonly factorAdded = output();
  readonly saveRequested = output();

  protected readonly views = computed<SegmentOption[]>(() =>
    VIEW_MODES.map((value) => ({ value, label: this.i18n.translate(`map.tab.${value}`) })),
  );

  protected readonly savedCount = computed(() => String(this.combination.saved().length));

  protected readonly layerName = computed(() => {
    const layer = this.view.layer();
    return layer === null ? '' : layerTitle(layer, this.i18n);
  });

  protected readonly layerGlyph = computed<IconName | undefined>(() => {
    const layer = this.view.layer();
    return layer === null ? undefined : (layerIcon(layer.id) ?? undefined);
  });

  protected readonly rules = computed<SegmentOption[]>(() =>
    (['intersection', 'graded'] as const).map((value) => ({
      value,
      label: this.i18n.translate(RULE_KEY[value]),
    })),
  );

  protected setView(value: string): void {
    const chosen = VIEW_MODES.find((mode) => mode === value);
    if (chosen) this.state.view.set(chosen);
  }

  protected setRule(value: string): void {
    if (value === 'intersection' || value === 'graded') this.combination.rule.set(value);
  }
}
