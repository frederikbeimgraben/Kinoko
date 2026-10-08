import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ViewportService } from '../../core/layout/viewport.service';
import { AboutTextComponent, type AboutSection } from './about-text.component';

const SECTIONS: readonly AboutSection[] = [
  { heading: 'account.licences.osmHeading', body: 'account.licences.osmBody' },
  { heading: 'account.licences.gbifHeading', body: 'account.licences.gbifBody' },
  { heading: 'account.licences.dwdHeading', body: 'account.licences.dwdBody' },
  { heading: 'account.licences.demHeading', body: 'account.licences.demBody' },
  { heading: 'account.licences.soilHeading', body: 'account.licences.soilBody' },
  { heading: 'account.licences.treesHeading', body: 'account.licences.treesBody' },
  { heading: 'account.licences.mapHeading', body: 'account.licences.mapBody' },
  { heading: 'account.licences.fontHeading', body: 'account.licences.fontBody' },
];

/** Sources and licences below the account: each data source of the map with its licence. */
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
