import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import type { BodyPart } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { decimal } from '../../core/i18n/numbers';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { AddRowComponent } from '../../ui/add-row/add-row.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { StateViewComponent } from '../../ui/state-view/state-view.component';
import { DIMENSION_TEXT, PART_TEXT } from '../species/labels';
import { SpeciesEditorStore } from './species-editor.store';
import { UNIT_TEXT } from './species-editor.rows';
import { termLabel } from './term-label';
import { changeRows, colourRows, sizeRows, type ColourRow, type SizeRow } from './section-part.rows';
import {
  changes,
  isBodyPart,
  isTraitPart,
  partDescription,
  withPartNote,
  withPartText,
  withoutPart,
} from './species-lists';

/** A part of a species: its measurements, its colours, its colour changes and its texts. */
@Component({
  selector: 'app-section-part',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    AddRowComponent,
    FormFieldComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    SectionComponent,
    StateViewComponent,
    TranslatePipe,
  ],
  templateUrl: './section-part.component.html',
  styleUrl: './section-part.component.scss',
})
export class SectionPartComponent {
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorStore);

  protected readonly slug = injectRouteParam('slug');
  private readonly partParam = injectRouteParam('part', 'cap');
  /** A route with an unknown part, for example `hut`, shows the not-found state. */
  protected readonly part = computed<BodyPart | null>(() => {
    const value = this.partParam();
    return isBodyPart(value) ? value : null;
  });

  protected readonly title = computed(() => {
    const part = this.part();
    return part === null ? this.i18n.translate('error.notFound') : this.i18n.translate(PART_TEXT[part]);
  });

  protected readonly sizes = computed<SizeRow[]>(() => {
    const part = this.part();
    if (part === null) return [];
    return sizeRows(this.state.species(), part, DIMENSION_TEXT, (one) => ({
      value: `${decimal(one.low, this.i18n.locale())} – ${decimal(one.high, this.i18n.locale())}`,
      unit: this.i18n.translate(UNIT_TEXT[one.unit]),
    }));
  });

  protected readonly colours = computed<ColourRow[]>(() => {
    const part = this.part();
    if (part === null) return [];
    const title = this.i18n.translate('admin.colour.title', { teil: this.i18n.translate(PART_TEXT[part]) });
    return colourRows(this.state.species(), part, title, this.i18n.translate('common.to'));
  });

  protected readonly changes = computed<ColourRow[]>(() => {
    const part = this.part();
    return part === null ? [] : changeRows(this.state.species(), part, (one) => termLabel(one, this.i18n));
  });

  private readonly note = computed(
    () => this.state.species()?.partNotes?.find((one) => one.part === this.part()) ?? null,
  );

  protected readonly description = linkedSignal(() => {
    const part = this.part();
    return part === null ? '' : partDescription(this.state.species(), part);
  });
  protected readonly comment = linkedSignal(() => this.note()?.comment ?? '');

  constructor() {
    this.state.load(this.slug);
  }

  /** A size row opens its own dimension. The add row opens the first dimension. */
  protected openSize(dimension?: string): void {
    const part = this.part();
    if (part === null) return;
    const queryParams = dimension === undefined ? {} : { dimension };
    void this.router.navigate(['/verwaltung/arten', this.slug(), 'mass', part], { queryParams });
  }

  protected openColour(at: number): void {
    this.open('farbe', String(at));
  }

  protected addColour(): void {
    this.openColour(this.colours().length);
  }

  protected openChange(at: number): void {
    this.open('verfaerbung', String(at));
  }

  protected addChange(): void {
    this.openChange(changes(this.state.species()).length);
  }

  private open(step: string, ...rest: string[]): void {
    const part = this.part();
    if (part !== null) void this.router.navigate(['/verwaltung/arten', this.slug(), step, part, ...rest]);
  }

  /** The description goes into the trait of the part, as the species page reads it. The comment goes into the note. */
  protected apply(): void {
    const part = this.part();
    const species = this.state.species();
    if (part === null || species === null) return;
    const comment = this.comment();
    this.state.save(
      isTraitPart(part)
        ? {
            traits: withPartText(species, part, this.description()),
            partNotes: withPartNote(species, { part, description: '', comment }),
          }
        : { partNotes: withPartNote(species, { part, description: this.description(), comment }) },
    );
    this.back();
  }

  protected remove(): void {
    const part = this.part();
    if (part === null) return;
    this.state.save(withoutPart(this.state.species(), part));
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }
}
