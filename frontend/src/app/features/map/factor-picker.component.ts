import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { layerIcon } from '../../core/tiles/layer-groups';
import { layerGroups, type Layer } from '../../core/tiles/layers';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SheetComponent } from '../../ui/sheet/sheet.component';
import { layerName, layerPeriod } from './layer-name';

/** The source of a new factor, per the board `FactorPickBody`. A source with a factor is not in the list. */
@Component({
  selector: 'app-factor-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ListRowComponent,
    OverlayHostComponent,
    RowGroupComponent,
    ScrollFadeDirective,
    SheetComponent,
    TranslatePipe,
  ],
  template: `
    <app-overlay-host [open]="open()" [modal]="true" (closed)="closed.emit()">
      <app-sheet
        [label]="'map.factor.choose' | t"
        [title]="'map.factor.choose' | t"
        [modal]="true"
        [dismissible]="true"
        (closed)="closed.emit()"
      >
        <div class="overlay-body picker" appScrollFade>
          <app-row-group>
            @for (layer of free(); track layer.id) {
              <app-list-row
                [title]="layer.name"
                [subline]="layer.period"
                [icon]="layerIcon(layer.id) ?? 'species'"
                [chevron]="true"
                [clickable]="true"
                (chosen)="chosen.emit(layer.layer)"
              />
            }
          </app-row-group>
        </div>
        <div foot class="picker__end"></div>
      </app-sheet>
    </app-overlay-host>
  `,
  styleUrl: './factor-picker.component.scss',
})
export class FactorPickerComponent {
  readonly open = input(false);
  readonly layers = input.required<readonly Layer[]>();
  readonly species = input<readonly Layer[]>([]);
  /** The sources that have a factor. They are not a choice. */
  readonly assigned = input<ReadonlySet<string>>(new Set());

  readonly chosen = output<Layer>();
  readonly closed = output();

  protected readonly layerIcon = layerIcon;

  private readonly i18n = inject(I18nService);

  /** The free sources with their names in the language of the app. */
  protected readonly free = computed(() => {
    const { perWeek, fixed } = layerGroups(this.layers());
    return [...perWeek, ...fixed, ...this.species()]
      .filter((layer) => !this.assigned().has(layer.id))
      .map((layer) => ({
        id: layer.id,
        layer,
        name: layerName(layer, this.i18n),
        period: layerPeriod(layer, this.i18n),
      }));
  });
}
