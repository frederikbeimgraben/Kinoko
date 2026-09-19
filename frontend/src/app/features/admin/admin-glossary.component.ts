import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { GlossaryState } from '../../core/access/glossary.state';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { FormSheetComponent } from '../../ui/form-sheet/form-sheet.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';

/** Ein neuer Begriff trägt noch keine Kennung. */
const NEW = 'neu';

/** Das Glossar der Verwaltung: anlegen, ändern, löschen. Braucht `text.edit`. */
@Component({
  selector: 'app-admin-glossary',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddRowComponent,
    FormFieldComponent,
    FormSheetComponent,
    ListRowComponent,
    PageHeaderComponent,
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

  protected readonly search = this.state.search;
  protected readonly entries = this.state.found;

  protected readonly editing = signal<string | null>(null);
  protected readonly term = signal('');
  protected readonly definition = signal('');
  protected readonly saving = signal(false);

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
    this.saving.set(true);
    const call = id === NEW ? this.state.create(write) : this.state.update(id, write);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.close();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected remove(): void {
    const id = this.editing();
    if (id === null || id === NEW) {
      this.close();
      return;
    }
    this.state.remove(id).subscribe(() => {
      this.close();
    });
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }
}
