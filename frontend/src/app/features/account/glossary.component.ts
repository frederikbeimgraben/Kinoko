import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GlossaryState } from '../../core/access/glossary.state';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';

/** Das Glossar unter dem Konto. Es steht auch ohne Anmeldung offen. */
@Component({
  selector: 'app-glossary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, SearchFieldComponent, TranslatePipe],
  templateUrl: './glossary.component.html',
  styleUrl: './glossary.component.scss',
})
export class GlossaryComponent {
  private readonly router = inject(Router);
  private readonly state = inject(GlossaryState);

  protected readonly search = this.state.search;
  protected readonly entries = this.state.found;

  constructor() {
    this.state.load();
  }

  protected onSearch(value: string): void {
    this.state.setSearch(value);
  }

  protected back(): void {
    void this.router.navigateByUrl('/konto');
  }
}
