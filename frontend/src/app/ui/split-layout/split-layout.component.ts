import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Das Rechner-Raster: Seitenleiste, eine feste Steuerspalte, Inhalt rechts.
 * Unter 1024 px liegen die drei Slots einfach untereinander. Das Telefon
 * baut ohnehin eigene Blätter statt dieses Rasters.
 */
@Component({
  selector: 'app-split-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './split-layout.component.html',
  styleUrl: './split-layout.component.scss',
})
export class SplitLayoutComponent {}
