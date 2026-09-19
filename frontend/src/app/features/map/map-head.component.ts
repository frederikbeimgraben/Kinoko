import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SheetHeadComponent } from '../../ui/sheet-head/sheet-head.component';
import { TimelineComponent, type TimelineWeek } from '../../ui/timeline/timeline.component';
import { MapView } from './map.view';

/** Der Kopf der Karte: Titel, Woche, Pfeile und darunter die Zeitleiste. */
@Component({
  selector: 'app-map-head',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SheetHeadComponent, TimelineComponent, TranslatePipe],
  templateUrl: './map-head.component.html',
  styleUrl: './map-head.component.scss',
})
export class MapHeadComponent {
  protected readonly view = inject(MapView);

  readonly playing = input(false);
  /** In der Spalte am Rechner steht die Art im Kopf, nicht der Reiter. */
  readonly column = input(false);

  readonly titleChosen = output();
  readonly weekChosen = output<TimelineWeek>();
  readonly stepped = output<1 | -1>();
  readonly playToggled = output();

  protected readonly dimmed = computed(() => this.view.fixedUncredited());
  protected readonly title = computed(() => (this.column() ? this.view.speciesTitle() : this.view.title()));
  protected readonly link = computed(() => this.column() || !this.view.onCombination());
}
