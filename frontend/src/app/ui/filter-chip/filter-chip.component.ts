import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/**
 * Eine aktive Marke im Filterkopf einer Liste: Beschriftung und X. Die Reihe
 * selbst, mit Verlauf zum Bildschirmrand, baut die Seite, die mehrere setzt.
 */
@Component({
  selector: 'app-filter-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './filter-chip.component.html',
  styleUrl: './filter-chip.component.scss',
})
export class FilterChipComponent {
  readonly label = input.required<string>();

  readonly removed = output();
}
