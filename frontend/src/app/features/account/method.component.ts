import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AboutTextComponent, type AboutSection } from './about-text.component';

const SECTIONS: readonly AboutSection[] = [
  { heading: 'account.method.whatHeading', body: 'account.method.whatBody' },
  { heading: 'account.method.modelHeading', body: 'account.method.modelBody' },
  { heading: 'account.method.horizonHeading', body: 'account.method.horizonBody' },
  { heading: 'account.method.uncertaintyHeading', body: 'account.method.uncertaintyBody' },
  { heading: 'account.method.notHeading', body: 'account.method.notBody' },
];

/** Die Methode unter dem Konto: was die Karte zeigt, wie und mit welcher Sicherheit. */
@Component({
  selector: 'app-method',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AboutTextComponent],
  templateUrl: './method.component.html',
})
export class MethodComponent {
  private readonly router = inject(Router);

  protected readonly title = 'account.method' as const;
  protected readonly sections = SECTIONS;

  protected back(): void {
    void this.router.navigateByUrl('/konto');
  }
}
