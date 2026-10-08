import { ChangeDetectionStrategy, Component } from '@angular/core';
import { SkeletonComponent } from './skeleton.component';

/** The map panel while it loads, per `MapSkeleton.dc.html`: the week strip, the view switch and the legend. */
@Component({
  selector: 'app-map-panel-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SkeletonComponent],
  templateUrl: './map-panel-skeleton.component.html',
  styleUrl: './map-panel-skeleton.component.scss',
  host: { 'aria-hidden': 'true' },
})
export class MapPanelSkeletonComponent {}
