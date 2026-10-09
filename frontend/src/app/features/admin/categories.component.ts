import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { grouped } from '../../core/i18n/numbers';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { TERM_KINDS, type TermKind } from '../../core/api/models';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { ConfirmDialogComponent } from '../../ui/confirm-dialog/confirm-dialog.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { FormSheetComponent } from '../../ui/form-sheet/form-sheet.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OptionSheetComponent, type OptionSheetOption } from '../../ui/option-sheet/option-sheet.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SearchFieldComponent } from '../../ui/search-field/search-field.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { RowGroupSkeletonComponent } from '../../ui/skeleton/row-group-skeleton.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { CategoriesStore } from './categories.store';
import { KIND_TEXT } from './labels';
import { termLabel } from './term-label';

/** A category without an id is not created yet. */
const NEW = 'neu';

/** The question of the confirmation. */
type Ask = 'delete' | 'merge';

/** The categories of the catalogue: create, rename, delete and merge. */
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
    RowGroupComponent,
    RowGroupSkeletonComponent,
    SearchFieldComponent,
    SegmentedComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly store = inject(CategoriesStore);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly search = this.store.search;
  protected readonly kind = this.store.kind;
  protected readonly categories = this.store.visible;

  /** The rows: the name in the UI language and the count of species that use the category. */
  protected readonly rows = computed(() =>
    this.categories().map((one) => ({
      id: one.id,
      name: termLabel(one, this.i18n),
      usage: one.usage === undefined ? '' : grouped(one.usage),
    })),
  );
  protected readonly saving = this.store.saving;
  protected readonly loaded = computed(() => this.store.items() !== null);

  protected readonly editing = signal<string | null>(null);
  protected readonly name = signal('');
  protected readonly picking = signal(false);
  protected readonly target = signal<string | null>(null);
  protected readonly asking = signal<Ask | null>(null);

  protected readonly kinds = computed<SegmentOption[]>(() =>
    TERM_KINDS.map((one) => ({ value: one, label: this.i18n.translate(KIND_TEXT[one]) })),
  );

  protected readonly sheetTitle = computed(
    () => this.name().trim() || this.i18n.translate('admin.category.create'),
  );

  /** Each other category of the kind can be the target. */
  protected readonly targets = computed<OptionSheetOption[]>(() =>
    this.categories()
      .filter((one) => one.id !== this.editing())
      .map((one) => ({ id: one.id, title: termLabel(one, this.i18n) })),
  );

  protected readonly askTitle = computed(() => {
    const ask = this.asking();
    if (ask === null) return '';
    const key = ask === 'delete' ? 'admin.categories.deleteConfirm' : 'admin.categories.mergeConfirm';
    return this.i18n.translate(key, { name: this.chosenName() });
  });

  constructor() {
    this.store.load();
  }

  protected onSearch(value: string): void {
    this.store.setSearch(value);
  }

  protected onKind(value: string): void {
    this.store.setKind(value as TermKind);
  }

  protected add(): void {
    this.name.set('');
    this.editing.set(NEW);
  }

  protected edit(id: string): void {
    const found = this.store.one(id);
    if (found === null) return;
    this.name.set(found.name);
    this.editing.set(id);
  }

  protected save(): void {
    const id = this.editing();
    const name = this.name().trim();
    if (id === null || name === '') return;
    this.store.save({
      id: id === NEW ? null : id,
      name,
      onDone: () => {
        this.close();
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

  /** A merge without a target sends no request. */
  protected confirm(): void {
    const id = this.editing();
    const ask = this.asking();
    const into = this.target();
    if (id === null || ask === null || (ask === 'merge' && into === null)) return;
    this.store.drop({
      id,
      into: ask === 'merge' ? into : null,
      onDone: () => {
        this.cancel();
        this.close();
      },
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

  private chosenName(): string {
    const id = this.editing();
    return id === null ? '' : (this.store.one(id)?.name ?? '');
  }
}
