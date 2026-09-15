import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { layerIcon } from '../../core/tiles/layer-groups';
import { layerGroups, unitOf, type Layer } from '../../core/tiles/layers';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { SvgIconComponent, type IconName } from '../../ui/svg-icon/svg-icon.component';
import { layerTitle } from './layer-name';

type GroupTitle = 'map.layer.perWeek' | 'map.layer.fixed' | 'map.factor.species';

/** Eine Quelle in der Wahl: Name, Zeichen und Einheit. */
interface Row {
  layer: Layer;
  name: string;
  icon: IconName;
  unit: string;
}

interface Group {
  title: GroupTitle;
  rows: readonly Row[];
}

/** Die Quelle eines neuen Faktors: Ebenen und Arten. Belegtes fehlt. */
@Component({
  selector: 'app-factor-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './factor-picker.component.html',
  styleUrl: './factor-picker.component.scss',
})
export class FactorPickerComponent {
  private readonly i18n = inject(I18nService);

  readonly layers = input.required<readonly Layer[]>();
  readonly species = input<readonly Layer[]>([]);
  /** Die Quellen, die schon einen Faktor haben. Sie stehen nicht zur Wahl. */
  readonly assigned = input<ReadonlySet<string>>(new Set());

  readonly chosen = output<Layer>();
  readonly closed = output();

  protected readonly groups = computed<Group[]>(() => {
    const { perWeek, fixed } = layerGroups(this.layers());
    return (
      [
        { title: 'map.layer.perWeek', layers: perWeek },
        { title: 'map.layer.fixed', layers: fixed },
        { title: 'map.factor.species', layers: this.species() },
      ] as const
    )
      .map((group) => ({ title: group.title, rows: this.rows(group.layers) }))
      .filter((group) => group.rows.length > 0);
  });

  private rows(layers: readonly Layer[]): Row[] {
    return layers
      .filter((layer) => !this.assigned().has(layer.id))
      .map((layer) => ({
        layer,
        name: layerTitle(layer, this.i18n),
        // Eine Art trägt das Zeichen der Arten, eine Ebene das ihrer Gruppe.
        icon: layerIcon(layer.id) ?? 'species',
        unit: unitOf(layer),
      }));
  }
}
