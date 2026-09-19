import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
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

/** Quellen und Lizenzen unter dem Konto: jede Datengrundlage der Karte mit ihrer Lizenz. */
@Component({
  selector: 'app-licences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AboutTextComponent],
  templateUrl: './licences.component.html',
})
export class LicencesComponent {
  private readonly router = inject(Router);

  protected readonly title = 'account.sourcesAndLicences' as const;
  protected readonly sections = SECTIONS;

  protected back(): void {
    void this.router.navigateByUrl('/konto');
  }
}
