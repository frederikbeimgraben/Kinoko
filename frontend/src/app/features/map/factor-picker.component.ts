import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { layerIcon } from '../../core/tiles/layer-groups';
import { layerGroups, unitOf, type Layer } from '../../core/tiles/layers';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { SvgIconComponent, type IconName } from '../../ui/svg-icon/svg-icon.component';
import { layerTitle } from './layer-name';

type GroupTitle = 'map.layer.perWeek' | 'map.layer.fixed' | 'map.factor.species';

interface Group {
  title: GroupTitle;
  layers: readonly Layer[];
}

/** Die Quelle eines neuen Faktors: Ebenen und Arten. Belegtes ist gesperrt. */
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
  /** Die Quellen, die schon einen Faktor haben. */
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
      .filter((group) => group.layers.length > 0)
      .map((group) => ({ title: group.title, layers: group.layers }));
  });

  protected name(layer: Layer): string {
    return layerTitle(layer, this.i18n);
  }

  protected icon(layer: Layer): IconName | undefined {
    return layerIcon(layer.id) ?? undefined;
  }

  protected unit(layer: Layer): string {
    return unitOf(layer);
  }

  protected subline(layer: Layer): string | undefined {
    return this.assigned().has(layer.id) ? this.i18n.translate('map.factor.assigned') : undefined;
  }
}
