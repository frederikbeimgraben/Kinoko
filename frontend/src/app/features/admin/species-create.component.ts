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
import { SheetComponent, type DetentSize } from '../../ui/sheet/sheet.component';
import { EDIBILITY_TEXT, GROUP_NAME_TEXT } from '../species/labels';
import { EMPTY_DRAFT, toWrite, type SpeciesDraft } from './species-create.draft';

/** Das Blatt der Auswahl ist so hoch wie sein Inhalt. */
const DETENTS: readonly [DetentSize, DetentSize, DetentSize] = [0.5, 0.5, 0.9];

/** Welche Auswahl offen steht. */
type Picker = 'group' | 'edibility';

/** Ein Wert der Auswahl mit seinem Namen. */
interface Choice {
  key: string;
  name: string;
}

/** Die neue Art: Name, Einordnung und Quelle. Die Merkmale folgen danach. */
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

  protected readonly groupName = computed(() => this.name(GROUP_NAME_TEXT[this.draft().group]));
  protected readonly edibilityName = computed(() => this.name(EDIBILITY_TEXT[this.draft().edibility]));

  protected readonly pickerTitle = computed(() =>
    this.i18n.translate(
      this.picking() === 'group' ? 'admin.species.field.group' : 'admin.species.field.edibility',
    ),
  );

  protected readonly choices = computed<Choice[]>(() => {
    if (this.picking() === 'edibility') {
      return EDIBILITIES.map((key) => ({ key, name: this.name(EDIBILITY_TEXT[key]) }));
    }
    return Object.keys(GROUP_NAME_TEXT).map((key) => ({ key, name: this.name(GROUP_NAME_TEXT[key]) }));
  });

  protected readonly chosen = computed<string>(() =>
    this.picking() === 'edibility' ? this.draft().edibility : this.draft().group,
  );

  protected set(field: keyof SpeciesDraft, value: string | boolean): void {
    this.draft.update((one) => ({ ...one, [field]: value }));
  }

  protected choose(key: string): void {
    if (this.picking() === 'edibility') this.set('edibility', key);
    else this.set('group', key);
    this.picking.set(null);
  }

  protected create(): void {
    this.saving.set(true);
    this.api.create(toWrite(this.draft(), this.today())).subscribe({
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
