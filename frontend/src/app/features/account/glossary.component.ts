import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { GlossaryStore } from '../../core/access/glossary.store';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';

/** The glossary, per `Glossary.dc.html`: a search bar and rows that wrap. It is open without a sign-in. */
@Component({
  selector: 'app-glossary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SearchFieldComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './glossary.component.html',
  styleUrl: './account-page.scss',
})
export class GlossaryComponent {
  private readonly router = inject(Router);
  private readonly store = inject(GlossaryStore);
  private readonly wide = inject(ViewportService).wide;

  protected readonly back = computed(() => !this.wide());
  protected readonly search = this.store.search;
  protected readonly entries = this.store.found;
  protected readonly loaded = computed(() => this.store.entries() !== null);

  constructor() {
    this.store.load();
  }

  protected onSearch(value: string): void {
    this.store.setSearch(value);
  }

  protected toAccount(): void {
    void this.router.navigateByUrl('/konto');
  }
}
