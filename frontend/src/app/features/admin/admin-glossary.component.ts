import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GlossaryState } from '../../core/access/glossary.state';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { FormSheetComponent } from '../../ui/form-sheet/form-sheet.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { AdminSharedStore } from './admin-shared.store';

/** A new entry has no id yet. */
const NEW = 'neu';

/** The glossary of the administration: create, change and delete. Needs `text.edit`. */
@Component({
  selector: 'app-admin-glossary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddRowComponent,
    FormFieldComponent,
    FormSheetComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SearchFieldComponent,
    TranslatePipe,
  ],
  templateUrl: './admin-glossary.component.html',
  styleUrl: './admin-glossary.component.scss',
})
export class AdminGlossaryComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(GlossaryState);
  private readonly writes = inject(AdminSharedStore);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly search = this.state.search;
  protected readonly entries = this.state.found;
  protected readonly loaded = computed(() => this.state.items() !== null);
  protected readonly saving = this.writes.saving;

  protected readonly editing = signal<string | null>(null);
  protected readonly term = signal('');
  protected readonly definition = signal('');

  protected readonly sheetTitle = computed(
    () => this.term().trim() || this.i18n.translate('glossary.create'),
  );

  constructor() {
    this.state.load();
  }

  protected onSearch(value: string): void {
    this.state.setSearch(value);
  }

  protected add(): void {
    this.term.set('');
    this.definition.set('');
    this.editing.set(NEW);
  }

  protected edit(id: string): void {
    const entry = this.state.one(id);
    if (entry === null) return;
    this.term.set(entry.term);
    this.definition.set(entry.definition);
    this.editing.set(id);
  }

  protected save(): void {
    const id = this.editing();
    const write = { term: this.term().trim(), definition: this.definition().trim() };
    if (id === null || write.term === '' || write.definition === '') return;
    this.writes.saveEntry({
      id: id === NEW ? null : id,
      write,
      onDone: () => {
        this.close();
      },
    });
  }

  protected remove(): void {
    const id = this.editing();
    if (id === null || id === NEW) {
      this.close();
      return;
    }
    this.writes.removeEntry({
      id,
      onDone: () => {
        this.close();
      },
    });
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }
}
