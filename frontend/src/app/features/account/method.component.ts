import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ViewportService } from '../../core/layout/viewport.service';
import { AboutTextComponent, type AboutSection } from './about-text.component';

const SECTIONS: readonly AboutSection[] = [
  { heading: 'account.method.whatHeading', body: 'account.method.whatBody' },
  { heading: 'account.method.modelHeading', body: 'account.method.modelBody' },
  { heading: 'account.method.horizonHeading', body: 'account.method.horizonBody' },
  { heading: 'account.method.uncertaintyHeading', body: 'account.method.uncertaintyBody' },
  { heading: 'account.method.notHeading', body: 'account.method.notBody' },
];

/** The method below the account: what the map shows, how, and how sure it is. */
@Component({
  selector: 'app-method',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AboutTextComponent],
  templateUrl: './method.component.html',
  host: { style: 'display: contents' },
})
export class MethodComponent {
  private readonly router = inject(Router);
  private readonly wide = inject(ViewportService).wide;

  protected readonly title = 'account.method' as const;
  protected readonly sections = SECTIONS;

  /** On the desktop the page is below "About the app"; on the phone it is below the account. */
  protected back(): void {
    void this.router.navigateByUrl(this.wide() ? '/konto/ueber' : '/konto');
  }
}
