import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal } from '@angular/core';
import { Router } from '@angular/router';
import type { GillAttachment, GillEdge, GillSpacing, HymeniumType } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { injectRouteParam } from '../../core/navigation/route-param';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent } from '../../ui/action-bar/action-bar.component';
import { ChipGroupComponent, type Chip } from '../../ui/chip-group/chip-group.component';
import { ListRowComponent } from '../../ui/list-row/list-row.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { RowGroupComponent } from '../../ui/row-group/row-group.component';
import { SectionComponent } from '../../ui/section/section.component';
import { SegmentedComponent, type SegmentOption } from '../../ui/segmented/segmented.component';
import { PART_TEXT } from '../species/labels';
import { injectColourLabel } from './colour-label';
import { SpeciesEditorStore } from './species-editor.store';
import { colourRows, type ColourRow } from './section-part.rows';
import {
  FIELD_TITLE,
  GILL_ONLY,
  HYMENIUM_TYPES_ORDER,
  choiceText,
  choicesOf,
  type HymeniumField,
} from './section-hymenium.rows';

/** A field with chips: its title, its chips and the chosen value. */
interface ChipField {
  field: Exclude<HymeniumField, 'kind'>;
  title: string;
  chips: Chip[];
  value: string[];
}

/** The hymenium of a species: the type, the gill fields and the colours of the hymenium. */
@Component({
  selector: 'app-section-hymenium',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    ChipGroupComponent,
    ListRowComponent,
    PageHeaderComponent,
    RowGroupComponent,
    SectionComponent,
    SegmentedComponent,
    TranslatePipe,
  ],
  templateUrl: './section-hymenium.component.html',
  styleUrl: './section-hymenium.component.scss',
})
export class SectionHymeniumComponent {
  private readonly i18n = inject(I18nService);
  private readonly colourLabel = injectColourLabel();
  private readonly router = inject(Router);
  private readonly state = inject(SpeciesEditorStore);

  protected readonly slug = injectRouteParam('slug');

  protected readonly kind = linkedSignal<HymeniumType | null>(
    () => this.state.species()?.hymeniumType ?? null,
  );
  private readonly attachment = linkedSignal<string | null>(
    () => this.state.species()?.gillAttachment ?? null,
  );
  private readonly spacing = linkedSignal<string | null>(() => this.state.species()?.gillSpacing ?? null);
  private readonly edge = linkedSignal<string | null>(() => this.state.species()?.gillEdge ?? null);

  protected readonly kinds = computed<SegmentOption[]>(() =>
    HYMENIUM_TYPES_ORDER.map((one) => ({ value: one, label: this.i18n.translate(choiceText('kind', one)) })),
  );

  /** Only gills and folds have an attachment, a spacing and an edge. */
  protected readonly fields = computed<ChipField[]>(() => {
    const kind = this.kind();
    if (kind === null || !GILL_ONLY.includes(kind)) return [];
    const held = { attachment: this.attachment(), spacing: this.spacing(), edge: this.edge() };
    return (['attachment', 'spacing', 'edge'] as const).map((field) => ({
      field,
      title: this.i18n.translate(FIELD_TITLE[field]),
      chips: choicesOf(field).map((value) => ({
        value,
        label: this.i18n.translate(choiceText(field, value)),
      })),
      value: held[field] === null ? [] : [held[field]],
    }));
  });

  /** The colour groups of the hymenium part. Each row opens its colour page. */
  protected readonly colours = computed<ColourRow[]>(() => {
    const kind = this.kind();
    if (kind === null || kind === 'spines' || kind === 'folds') return [];
    const title = this.i18n.translate('admin.colour.title', { teil: this.i18n.translate(PART_TEXT[kind]) });
    return colourRows(this.state.species(), kind, title, this.i18n.translate('common.to'), this.colourLabel);
  });

  constructor() {
    this.state.load(this.slug);
  }

  protected chooseKind(value: string): void {
    this.kind.set(value as HymeniumType);
  }

  protected chooseField(field: ChipField['field'], values: readonly string[]): void {
    const value = values[0] ?? null;
    if (field === 'attachment') this.attachment.set(value);
    if (field === 'spacing') this.spacing.set(value);
    if (field === 'edge') this.edge.set(value);
  }

  protected openColour(at: number): void {
    const kind = this.kind();
    if (kind !== null) void this.router.navigate(['/verwaltung/arten', this.slug(), 'farbe', kind, at]);
  }

  /** A type without gill fields clears them, so the species keeps no stale value. */
  protected apply(): void {
    const kind = this.kind();
    const gills = kind !== null && GILL_ONLY.includes(kind);
    this.state.save({
      hymeniumType: kind,
      gillAttachment: gills ? (this.attachment() as GillAttachment | null) : null,
      gillSpacing: gills ? (this.spacing() as GillSpacing | null) : null,
      gillEdge: gills ? (this.edge() as GillEdge | null) : null,
    });
    this.back();
  }

  protected back(): void {
    void this.router.navigate(['/verwaltung/arten', this.slug()]);
  }
}
