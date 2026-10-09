import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import type { SpeciesEntry } from '../../../core/api/models';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ListRowComponent } from '../../../ui/list-row/list-row.component';
import { RowGroupComponent } from '../../../ui/row-group/row-group.component';
import { SectionComponent } from '../../../ui/section/section.component';
import { MapStore } from '../../map/map.store';

/** The forecast of a species: a link to its map, or a note that the entry is for reference only. */
@Component({
  selector: 'app-species-forecast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ListRowComponent, RowGroupComponent, SectionComponent, TranslatePipe],
  templateUrl: './species-forecast.component.html',
  host: { style: 'display: block' },
})
export class SpeciesForecastComponent {
  private readonly map = inject(MapStore);
  private readonly router = inject(Router);

  readonly species = input.required<SpeciesEntry>();

  /** Opens the map with the forecast of this species. */
  protected async showOnMap(): Promise<void> {
    this.map.setSpecies(this.species().slug);
    this.map.setView('forecast');
    await this.router.navigateByUrl('/karte');
  }
}
