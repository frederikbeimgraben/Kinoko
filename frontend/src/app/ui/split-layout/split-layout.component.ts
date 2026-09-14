import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Das Rechner-Raster: Seitenleiste, Steuerspalte, Inhalt. Sonst untereinander.
 */
@Component({
  selector: 'app-split-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './split-layout.component.html',
  styleUrl: './split-layout.component.scss',
})
export class SplitLayoutComponent {}
