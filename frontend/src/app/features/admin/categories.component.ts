import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import type { Observable } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TERM_KINDS, type TermKind } from '../../core/api/models';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { FormSheetComponent } from '../../ui/form-sheet/form-sheet.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { CategoriesState } from './categories.state';
import { KIND_TEXT } from './labels';

/** Eine Kategorie ohne Kennung ist noch nicht angelegt. */
const NEW = 'neu';

/** Was die Bestätigung gerade fragt. */
type Ask = 'delete' | 'merge';

/** Die Kategorien des Katalogs: anlegen, umbenennen, löschen, zusammenführen. */
@Component({
  selector: 'app-categories',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AddRowComponent,
    ConfirmDialogComponent,
    FormFieldComponent,
    FormSheetComponent,
    ListRowComponent,
    OptionSheetComponent,
    PageHeaderComponent,
    SearchFieldComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(CategoriesState);

  protected readonly search = this.state.search;
  protected readonly kind = this.state.kind;
  protected readonly categories = this.state.visible;

  protected readonly editing = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly saving = signal(false);
  protected readonly picking = signal(false);
  protected readonly target = signal<string | null>(null);
  protected readonly asking = signal<Ask | null>(null);

  protected readonly kinds = computed<SegmentOption[]>(() =>
    TERM_KINDS.map((one) => ({ value: one, label: this.i18n.translate(KIND_TEXT[one]) })),
  );

  protected readonly sheetTitle = computed(
    () => this.name().trim() || this.i18n.translate('admin.category.create'),
  );

  /** Jede andere Kategorie der Gattung kommt als Ziel infrage. */
  protected readonly targets = computed<OptionSheetOption[]>(() =>
    this.categories()
      .filter((one) => one.id !== this.editing())
      .map((one) => ({ id: one.id, title: one.name })),
  );

  protected readonly askTitle = computed(() => {
    const ask = this.asking();
    if (ask === null) return '';
    const key = ask === 'delete' ? 'admin.categories.deleteConfirm' : 'admin.categories.mergeConfirm';
    return this.i18n.translate(key, { name: this.chosenName() });
  });

  constructor() {
    this.state.load();
  }

  protected onSearch(value: string): void {
    this.state.setSearch(value);
  }

  protected onKind(value: string): void {
    this.state.setKind(value as TermKind);
  }

  protected add(): void {
    this.name.set('');
    this.editing.set(NEW);
  }

  protected edit(id: string): void {
    const found = this.state.one(id);
    if (found === null) return;
    this.name.set(found.name);
    this.editing.set(id);
  }

  protected save(): void {
    const id = this.editing();
    const name = this.name().trim();
    if (id === null || name === '') return;
    this.saving.set(true);
    const call = id === NEW ? this.state.create(name) : this.state.rename(id, name);
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

  protected askDelete(): void {
    const id = this.editing();
    if (id === null || id === NEW) {
      this.close();
      return;
    }
    this.asking.set('delete');
  }

  protected pick(): void {
    this.picking.set(true);
  }

  protected onTarget(id: string): void {
    this.target.set(id);
    this.picking.set(false);
    this.asking.set('merge');
  }

  protected confirm(): void {
    const id = this.editing();
    const ask = this.asking();
    if (id === null || ask === null) return;
    const call = ask === 'delete' ? this.state.remove(id) : this.mergeCall(id);
    if (call === null) return;
    call.subscribe(() => {
      this.cancel();
      this.close();
    });
  }

  protected cancel(): void {
    this.asking.set(null);
    this.target.set(null);
  }

  protected close(): void {
    this.editing.set(null);
    this.picking.set(false);
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung');
  }

  /** Ohne Ziel steht kein Aufruf an. */
  private mergeCall(id: string): Observable<null> | null {
    const into = this.target();
    return into === null ? null : this.state.merge(id, into);
  }

  private chosenName(): string {
    const id = this.editing();
    return id === null ? '' : (this.state.one(id)?.name ?? '');
  }
}
