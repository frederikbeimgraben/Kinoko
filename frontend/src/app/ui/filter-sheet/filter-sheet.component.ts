import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { OverlayHostComponent } from '../overlay-host/overlay-host.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Blatt für Filterinhalte: Kopf mit Titel, Zurücksetzen und X, Fuß mit einer Aktion. */
@Component({
  selector: 'app-filter-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHostComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './filter-sheet.component.html',
  styleUrl: './filter-sheet.component.scss',
})
export class FilterSheetComponent {
  readonly open = input.required<boolean>();
  readonly resetEnabled = input(false);
  readonly primaryLabel = input.required<string>();

  readonly resetClick = output();
  readonly primaryClick = output();
  readonly closed = output();
}
