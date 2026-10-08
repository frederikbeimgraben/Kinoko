import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { layerIcon } from '../../core/tiles/layer-groups';
import { layerGroups, type Layer } from '../../core/tiles/layers';
import { SvgIconComponent, type IconName } from '../../ui/svg-icon/svg-icon.component';
import { layerTitle } from './layer-name';

/** A layer with its name and its icon. */
interface LayerCard {
  layer: Layer;
  name: string;
  glyph: IconName;
}

interface Group {
  title: 'ebene.jeWoche' | 'ebene.fest';
  cards: readonly LayerCard[];
}

/** Shows the layers in two groups: weekly layers and constant layers. */
@Component({
  selector: 'app-layer-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './layer-list.component.html',
  styleUrl: './layer-list.component.scss',
})
export class LayerListComponent {
  private readonly i18n = inject(I18nService);

  readonly layers = input.required<readonly Layer[]>();
  readonly selected = input<string | null>(null);
  readonly label = input.required<string>();

  readonly chosen = output<Layer>();

  protected readonly groups = computed<Group[]>(() => {
    const { perWeek, fixed } = layerGroups(this.layers());
    const groups: Group[] = [
      { title: 'ebene.jeWoche', cards: perWeek.map((layer) => this.card(layer)) },
      { title: 'ebene.fest', cards: fixed.map((layer) => this.card(layer)) },
    ];
    return groups.filter((group) => group.cards.length > 0);
  });

  /** An unknown layer gets the general layers icon. */
  private card(layer: Layer): LayerCard {
    return { layer, name: layerTitle(layer, this.i18n), glyph: layerIcon(layer.id) ?? 'layers' };
  }
}
