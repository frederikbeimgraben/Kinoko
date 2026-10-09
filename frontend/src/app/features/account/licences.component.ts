import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ViewportService } from '../../core/layout/viewport.service';
import { AboutTextComponent, type AboutSection } from './about-text.component';

const SECTIONS: readonly AboutSection[] = [
  { heading: 'account.licences.mapData', body: 'account.licences.mapDataSub' },
  { heading: 'account.licences.speciesData', body: 'account.licences.speciesDataSub' },
  { heading: 'account.licences.occurrences', body: 'account.licences.occurrencesSub' },
  { heading: 'account.licences.weatherData', body: 'account.licences.weatherDataSub' },
  { heading: 'account.licences.images', body: 'account.licences.imagesSub' },
];

/** Sources and licences below the account, per `AboutLicences.dc.html`: each source with its licence. */
@Component({
  selector: 'app-licences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AboutTextComponent],
  templateUrl: './licences.component.html',
  host: { style: 'display: contents' },
})
export class LicencesComponent {
  private readonly router = inject(Router);
  private readonly wide = inject(ViewportService).wide;

  protected readonly title = 'account.sourcesAndLicences' as const;
  protected readonly sections = SECTIONS;

  /** On the desktop the page is below "About the app"; on the phone it is below the account. */
  protected back(): void {
    void this.router.navigateByUrl(this.wide() ? '/konto/ueber' : '/konto');
  }
}
