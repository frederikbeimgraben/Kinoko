import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { layerIcon } from '../../core/tiles/layer-groups';
import { layerGroups, type Layer } from '../../core/tiles/layers';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { ScrollFadeDirective } from '../../ui/scroll-fade/scroll-fade.directive';
import { SheetComponent } from '../../ui/sheet/sheet.component';

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
                [title]="layer.label"
                [subline]="layer.note || undefined"
                [icon]="layerIcon(layer.id) ?? 'species'"
                [chevron]="true"
                [clickable]="true"
                (chosen)="chosen.emit(layer)"
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

  protected readonly free = computed<readonly Layer[]>(() => {
    const { perWeek, fixed } = layerGroups(this.layers());
    return [...perWeek, ...fixed, ...this.species()].filter((layer) => !this.assigned().has(layer.id));
  });
}
