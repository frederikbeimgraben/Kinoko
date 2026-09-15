import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Location } from '@angular/common';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { ViewportService } from '../../../core/layout/viewport.service';
import { ColourFieldComponent } from '../../../ui/colour-field/colour-field.component';
import { KeyValueRowComponent } from '../../../ui/key-value-table/key-value-row.component';
import { KeyValueTableComponent } from '../../../ui/key-value-table/key-value-table.component';
import { LevelPillComponent } from '../../../ui/level-pill/level-pill.component';
import { PageHeaderComponent } from '../../../ui/page-header/page-header.component';
import { SvgIconComponent } from '../../../ui/svg-icon/svg-icon.component';
import { TagListComponent } from '../../../ui/tag-list/tag-list.component';
import { YearBandComponent } from '../../../ui/year-band/year-band.component';
import { PART_TEXT } from '../labels';
import { SpeciesState } from '../species.state';
import { ComparisonState } from './comparison.state';
import {
  capWidthOf,
  hymeniumPartOf,
  levelOf,
  monthMarks,
  periodOf,
  pressureOf,
  stemNetOf,
  swatchOf,
  flavoursOf,
  type Swatch,
} from './comparison.rows';

/** Eine Zeile Farbe: der Name des Teils und eine Fläche je Art. */
interface ColourRow {
  key: string;
  cells: readonly (Swatch | null)[];
}

/** Zwei oder mehr Arten nebeneinander, ein Merkmal je Zeile. */
@Component({
  selector: 'app-comparison',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ColourFieldComponent,
    KeyValueRowComponent,
    KeyValueTableComponent,
    LevelPillComponent,
    PageHeaderComponent,
    SvgIconComponent,
    TagListComponent,
    TranslatePipe,
    YearBandComponent,
  ],
  templateUrl: './comparison.component.html',
  styleUrl: './comparison.component.scss',
})
export class ComparisonComponent {
  private readonly catalogue = inject(SpeciesState);
  private readonly comparison = inject(ComparisonState);
  private readonly location = inject(Location);
  private readonly i18n = inject(I18nService);

  protected readonly wide = inject(ViewportService).wide;
  protected readonly species = this.comparison.species;
  protected readonly names = computed(() => this.species().map((one) => one.name));

  protected readonly count = computed(() =>
    this.i18n.translate('species.taxonomy.speciesCount', { anzahl: this.species().length }),
  );

  protected readonly levels = computed(() => this.species().map((one) => levelOf(one, this.i18n)));
  protected readonly widths = computed(() => this.species().map((one) => capWidthOf(one, this.i18n)));
  private readonly capColours = computed(() => this.species().map((one) => swatchOf(one, 'cap')));
  protected readonly stemNets = computed(() => this.species().map((one) => stemNetOf(one)));
  protected readonly flavours = computed(() => this.species().map((one) => flavoursOf(one)));
  protected readonly periods = computed(() => this.species().map((one) => periodOf(one)));

  private readonly hymenium = computed(() => hymeniumPartOf(this.species()));

  private readonly hymeniumName = computed(() => {
    const part = this.hymenium();
    return part === null ? '' : this.i18n.translate(PART_TEXT[part]);
  });

  private readonly hymeniumColours = computed(() =>
    this.species().map((one) => swatchOf(one, this.hymenium())),
  );

  /** Hut und Fruchtschicht tragen dieselbe Zelle, darum eine Liste. */
  protected readonly colourRows = computed<ColourRow[]>(() =>
    [
      { key: this.i18n.translate('species.compare.capColour'), cells: this.capColours() },
      { key: this.hymeniumName(), cells: this.hymeniumColours() },
    ].filter((row) => this.filled(row.cells)),
  );

  protected readonly pressures = computed(() =>
    this.species().map((one) => pressureOf(one, this.hymenium(), this.i18n)),
  );

  /** Die Marken des Jahres brauchen Breite; am Telefon trägt die Zelle keine. */
  protected readonly marks = computed(() => (this.wide() ? monthMarks(this.i18n) : []));

  protected readonly arrowLabel = computed(() => this.i18n.translate('common.to'));
  protected readonly bandLabel = computed(() => this.i18n.translate('species.growthPeriod'));
  protected readonly flavourLabel = computed(() => this.i18n.translate('species.field.taste'));

  constructor() {
    void this.catalogue.loadBundle();
  }

  /** Eine Zeile ohne einen einzigen Wert bleibt aus. */
  protected filled(cells: readonly unknown[]): boolean {
    return cells.some((one) => one !== null);
  }

  protected back(): void {
    this.location.back();
  }
}
