import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { layerName, layerPeriod } from './layer-name';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { layerIcon, type LayerIcon } from '../../core/tiles/layer-groups';
import type { Layer } from '../../core/tiles/layers';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { FactorRowComponent } from '../../ui/factor-row/factor-row.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { conditionText, type Factor } from './factors';

/** A factor with its resolved source, as the row needs it. */
interface Row {
  factor: Factor;
  name: string;
  subline: string;
  condition: string;
  icon: LayerIcon | null;
}

/** The factors of the combination view as one group, per the board `MapCombination`. */
@Component({
  selector: 'app-combination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AddRowComponent, FactorRowComponent, RowGroupComponent, TranslatePipe],
  templateUrl: './combination.component.html',
})
export class CombinationComponent {
  private readonly i18n = inject(I18nService);

  readonly factors = input.required<readonly Factor[]>();
  /** The sources of the factors by identifier. A factor without a source does not show. */
  readonly sources = input.required<ReadonlyMap<string, Layer>>();

  readonly openFactor = output<string>();
  readonly removed = output<Factor>();
  readonly add = output();

  protected readonly rows = computed<Row[]>(() => {
    const sources = this.sources();
    const locale = this.i18n.locale();
    const to = this.i18n.translate('common.to');
    return this.factors().flatMap((factor) => {
      const layer = sources.get(factor.source);
      if (!layer) return [];
      return [
        {
          factor,
          name: layerName(layer, this.i18n),
          subline: layerPeriod(layer, this.i18n),
          condition: conditionText(factor, layer, locale, to),
          icon: layerIcon(layer.id),
        },
      ];
    });
  });
}
