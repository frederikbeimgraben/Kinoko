import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { OverlayHostComponent } from '../overlay-host/overlay-host.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Blatt für Filterinhalte: Übersicht mit X, Gruppe mit Weg zurück. */
@Component({
  selector: 'app-filter-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [OverlayHostComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './filter-sheet.component.html',
  styleUrl: './filter-sheet.component.scss',
})
export class FilterSheetComponent {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly resetEnabled = input(false);
  readonly primaryLabel = input.required<string>();
  /** Eine Gruppe zeigt den Pfeil zurück statt Zurücksetzen und X. */
  readonly back = input(false);

  readonly resetClick = output();
  readonly primaryClick = output();
  readonly backClick = output();
  readonly closed = output();
}
