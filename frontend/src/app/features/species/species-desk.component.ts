import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { SplitLayoutComponent } from '../../ui/split-layout/split-layout.component';
import { SpeciesBrowserComponent } from './species-browser.component';

/** The desktop frame of the species routes. Each route draws the same list pane,
 * so a route change crossfades only the detail pane. */
@Component({
  selector: 'app-species-desk',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SpeciesBrowserComponent, SplitLayoutComponent],
  templateUrl: './species-desk.component.html',
  styleUrl: './species-desk.component.scss',
})
export class SpeciesDeskComponent {
  /** The slug of the species in the detail pane. */
  readonly active = input<string | null>(null);
}
