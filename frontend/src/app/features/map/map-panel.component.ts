import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { FilterChipComponent } from '../../ui/filter-chip/filter-chip.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { TimelineComponent, type TimelineWeek } from '../../ui/timeline/timeline.component';
import { VIEW_MODES } from './map.store';
import { MapView } from './map.view';

/** The head of the map, per the board `MapPanel`: species, week, week strip and view tabs. */
@Component({
  selector: 'app-map-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FilterChipComponent, SegmentedComponent, TimelineComponent, TranslatePipe],
  templateUrl: './map-panel.component.html',
  styleUrl: './map-panel.component.scss',
})
export class MapPanelComponent {
  private readonly i18n = inject(I18nService);
  protected readonly view = inject(MapView);
  protected readonly state = this.view.state;
  protected readonly wide = inject(ViewportService).wide;

  readonly titleChosen = output();
  readonly weekChosen = output<TimelineWeek>();

  protected readonly views = computed<SegmentOption[]>(() =>
    VIEW_MODES.map((value) => ({ value, label: this.i18n.translate(`map.tab.${value}`) })),
  );

  protected readonly onForecast = computed(() => this.state.view() === 'forecast');

  /** A fixed layer has no week, so the strip is less prominent. */
  protected readonly dimmed = computed(() => this.view.fixedLayer());

  protected setView(value: string): void {
    const chosen = VIEW_MODES.find((mode) => mode === value);
    if (chosen) this.state.setView(chosen);
  }
}
