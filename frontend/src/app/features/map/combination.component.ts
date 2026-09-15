import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { layerIcon, type LayerIcon } from '../../core/tiles/layer-groups';
import type { Layer } from '../../core/tiles/layers';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { FactorRowComponent } from '../../ui/factor-row/factor-row.component';
import { conditionText, type Factor } from './factors';

/** Ein Faktor, wie ihn die Zeile braucht: mit aufgelöster Quelle. */
interface Row {
  factor: Factor;
  name: string;
  subline: string;
  condition: string;
  icon: LayerIcon | null;
}

/** Die Darstellung „Kombination“: die Faktoren und die Aktionen darunter. */
@Component({
  selector: 'app-combination',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, AddRowComponent, FactorRowComponent, TranslatePipe],
  templateUrl: './combination.component.html',
  styleUrl: './combination.component.scss',
})
export class CombinationComponent {
  private readonly i18n = inject(I18nService);

  readonly factors = input.required<readonly Factor[]>();
  /** Die Quellen der Faktoren, nach Kennung. Was fehlt, wird nicht gezeigt. */
  readonly sources = input.required<ReadonlyMap<string, Layer>>();

  readonly openFactor = output<string>();
  readonly removed = output<Factor>();
  readonly add = output();
  readonly saveRequested = output();

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
          name: layer.label,
          subline: layer.note,
          condition: conditionText(factor, layer, locale, to),
          icon: layerIcon(layer.id),
        },
      ];
    });
  });

  protected readonly canSave = computed(() => this.factors().length > 0);

  /** `app-action-bar` zeigt keinen gesperrten Zustand, darum prüft der Griff. */
  protected requestSave(): void {
    if (this.canSave()) this.saveRequested.emit();
  }
}
