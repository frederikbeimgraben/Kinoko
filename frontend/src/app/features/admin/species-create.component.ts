import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { EDIBILITIES } from '../../core/api/models';
import { SpeciesApi } from '../../core/api/species.api';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { CheckRowComponent } from '../../ui/check-row/check-row.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { OverlayHostComponent } from '../../ui/overlay-host/overlay-host.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { SheetComponent, type DetentSize } from '../../ui/sheet/sheet.component';
import { GROUP_NAME_TEXT } from '../species/labels';
import { EDIBILITY_SHORT_TEXT } from './labels';
import { EMPTY_DRAFT, toWrite, type SpeciesDraft } from './species-create.draft';

/** The choice sheet has the height of its content. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = [0.5, 0.5, 0.9];

/** The choice that is open in the sheet. */
type Picker = 'group';

/** A choice value with its name. */
interface Choice {
  key: string;
  name: string;
}

/** Makes a new species: name, classification and source. The features come after this step. */
@Component({
  selector: 'app-species-create',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CheckRowComponent,
    FormFieldComponent,
    ListRowComponent,
    OverlayHostComponent,
    PageHeaderComponent,
    RowGroupComponent,
    SectionComponent,
    SegmentedComponent,
    SheetComponent,
    TranslatePipe,
  ],
  templateUrl: './species-create.component.html',
  styleUrl: './species-create.component.scss',
})
export class SpeciesCreateComponent {
  private readonly api = inject(SpeciesApi);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  protected readonly DETENTS = DETENTS;
  protected readonly draft = signal<SpeciesDraft>(EMPTY_DRAFT);
  protected readonly picking = signal<Picker | null>(null);
  protected readonly saving = signal(false);

  protected readonly groupName = computed(() => {
    const group = this.draft().group;
    return group === null ? this.i18n.translate('common.none') : this.name(GROUP_NAME_TEXT[group]);
  });

  protected readonly pickerTitle = computed(() => this.i18n.translate('admin.species.field.group'));

  protected readonly choices = computed<Choice[]>(() =>
    Object.keys(GROUP_NAME_TEXT).map((key) => ({ key, name: this.name(GROUP_NAME_TEXT[key]) })),
  );

  protected readonly chosen = computed<string>(() => this.draft().group ?? '');

  /** The edibility is a segmented choice, as the board shows it. */
  protected readonly edibilities = computed<SegmentOption[]>(() =>
    EDIBILITIES.map((key) => ({ value: key, label: this.name(EDIBILITY_SHORT_TEXT[key]) })),
  );

  protected set(field: keyof SpeciesDraft, value: string | boolean): void {
    this.draft.update((one) => ({ ...one, [field]: value }));
  }

  protected choose(key: string): void {
    this.set('group', key);
    this.picking.set(null);
  }

  /** Without a group, the species cannot be made: the group sheet opens. */
  protected create(): void {
    const write = toWrite(this.draft(), this.today());
    if (write === null) {
      this.picking.set('group');
      return;
    }
    this.saving.set(true);
    this.api.create(write).subscribe({
      next: (entry) => {
        void this.router.navigateByUrl(`/verwaltung/arten/${entry.slug}`);
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  protected back(): void {
    void this.router.navigateByUrl('/verwaltung/arten');
  }

  private name(key: TranslationKey | undefined): string {
    return key === undefined ? '' : this.i18n.translate(key);
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
