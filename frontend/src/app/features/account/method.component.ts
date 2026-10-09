import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ViewportService } from '../../core/layout/viewport.service';
import { AboutTextComponent, type AboutSection } from './about-text.component';

const SECTIONS: readonly AboutSection[] = [
  { heading: 'account.method.visits', body: 'account.method.visitsSub' },
  { heading: 'account.method.weather', body: 'account.method.weatherSub' },
  { heading: 'account.method.model', body: 'account.method.modelSub' },
  { heading: 'account.method.calibration', body: 'account.method.calibrationSub' },
  { heading: 'account.method.update', body: 'account.method.updateSub' },
];

/** The method below the account, per `AboutMethod.dc.html`: the inputs, the model and the update cycle. */
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
