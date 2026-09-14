import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { BadgeComponent, CardComponent } from '@stupa-makers/ui-kit';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  ActionBarComponent,
  AvatarButtonComponent,
  BannerComponent,
  CheckRowComponent,
  ChipGroupComponent,
  ChoiceRowComponent,
  ColourChangeComponent,
  ColourFieldComponent,
  ColourPickerComponent,
  ColourSwatchesComponent,
  ConfirmDialogComponent,
  CrosshairComponent,
  EmptyStateComponent,
  EntryRowComponent,
  ErrorStateComponent,
  FactorRowComponent,
  FilterChipComponent,
  FilterSheetComponent,
  FloatingButtonComponent,
  FormFieldComponent,
  HistogramComponent,
  IconButtonComponent,
  ImageCreditComponent,
  ImageTileComponent,
  ImageViewerComponent,
  InfiniteListComponent,
  KeyValueRowComponent,
  KeyValueTableComponent,
  LevelPillComponent,
  ListRowComponent,
  MeasurementComponent,
  MeasurementGroupComponent,
  NavComponent,
  ObjectMenuComponent,
  OverlayHostComponent,
  PageHeaderComponent,
  PhotoPickerComponent,
  PrivateImageComponent,
  ProgressComponent,
  RampComponent,
  RangeSliderComponent,
  ReviewQueueComponent,
  SearchFieldComponent,
  SeasonCurveComponent,
  SegmentedComponent,
  SheetComponent,
  SheetHeadComponent,
  SkeletonComponent,
  SpeciesPickerComponent,
  SpeciesRowComponent,
  SplitLayoutComponent,
  StatRowComponent,
  SvgIconComponent,
  TagListComponent,
  TimelineComponent,
  WeekButtonComponent,
  YearBandComponent,
  YearBandInputComponent,
  OBJECT_COLOURS,
  type Detent,
  type ObjectMenuTarget,
} from '../../ui';
import {
  BRUISE_COLOURS,
  CAP_COLOURS,
  CAP_WIDTH_SPANS,
  FLESH_COLOURS,
  GRADIENT_COLOURS,
  LATIN_NAMES,
  MULTI_COLOURS,
  SAMPLE_ALL_YEARS,
  SAMPLE_CURRENT_YEAR,
  SAMPLE_HISTOGRAM,
  SAMPLE_IMAGE,
  SAMPLE_WEEKS,
  SPORE_LENGTH_SPANS,
  TREE_GENERA,
} from './sample-data';

/** Die Werkstattseite: jeder Baustein aus `ui/` in jeder Variante, hell und dunkel. */
@Component({
  selector: 'app-building-blocks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    AvatarButtonComponent,
    BadgeComponent,
    BannerComponent,
    CardComponent,
    CheckRowComponent,
    ChipGroupComponent,
    ChoiceRowComponent,
    ColourChangeComponent,
    ColourFieldComponent,
    ColourPickerComponent,
    ColourSwatchesComponent,
    ConfirmDialogComponent,
    CrosshairComponent,
    EmptyStateComponent,
    EntryRowComponent,
    ErrorStateComponent,
    FactorRowComponent,
    FilterChipComponent,
    FilterSheetComponent,
    FloatingButtonComponent,
    FormFieldComponent,
    HistogramComponent,
    IconButtonComponent,
    ImageCreditComponent,
    ImageTileComponent,
    ImageViewerComponent,
    InfiniteListComponent,
    KeyValueRowComponent,
    KeyValueTableComponent,
    LevelPillComponent,
    ListRowComponent,
    MeasurementComponent,
    MeasurementGroupComponent,
    NavComponent,
    NgTemplateOutlet,
    ObjectMenuComponent,
    OverlayHostComponent,
    PageHeaderComponent,
    PhotoPickerComponent,
    PrivateImageComponent,
    ProgressComponent,
    RampComponent,
    RangeSliderComponent,
    ReviewQueueComponent,
    SearchFieldComponent,
    SeasonCurveComponent,
    SegmentedComponent,
    SheetComponent,
    SheetHeadComponent,
    SkeletonComponent,
    SpeciesPickerComponent,
    SpeciesRowComponent,
    SplitLayoutComponent,
    StatRowComponent,
    SvgIconComponent,
    TagListComponent,
    TimelineComponent,
    TranslatePipe,
    WeekButtonComponent,
    YearBandComponent,
    YearBandInputComponent,
  ],
  templateUrl: './building-blocks.component.html',
  styleUrl: './building-blocks.component.scss',
})
export class BuildingBlocksComponent {
  private readonly i18n = inject(I18nService);
  private readonly lightPane = viewChild.required<ElementRef<HTMLElement>>('light');
  private readonly darkPane = viewChild.required<ElementRef<HTMLElement>>('dark');

  protected readonly weeks = SAMPLE_WEEKS;
  protected readonly seasonSeries = [
    { shape: 'area' as const, values: SAMPLE_ALL_YEARS, legend: this.text('art.kurve.jahre') },
    { shape: 'line' as const, values: SAMPLE_CURRENT_YEAR, legend: this.text('art.kurve.laufend') },
  ];
  protected readonly seasonPlain = [
    { shape: 'area' as const, values: SAMPLE_ALL_YEARS },
    { shape: 'line' as const, values: SAMPLE_CURRENT_YEAR },
  ];
  protected readonly histogramm = SAMPLE_HISTOGRAM;
  protected readonly objectColors = OBJECT_COLOURS;
  protected readonly sampleImage = SAMPLE_IMAGE;
  protected readonly treeGenera = TREE_GENERA;
  protected readonly capColours = CAP_COLOURS;
  protected readonly fleshColours = FLESH_COLOURS;
  protected readonly bruiseColours = BRUISE_COLOURS;
  protected readonly gradientColours = GRADIENT_COLOURS;
  protected readonly multiColours = MULTI_COLOURS;
  protected readonly capWidthSpans = CAP_WIDTH_SPANS;
  protected readonly sporeLengthSpans = SPORE_LENGTH_SPANS;
  protected readonly reviewItems = LATIN_NAMES;

  protected readonly activeWeek = signal({ year: 2025, week: 40 });
  protected readonly detent = signal<Detent>(1);
  protected readonly viewMode = signal('ebene');
  protected readonly chip = signal<readonly string[]>(['alle']);
  protected readonly checked = signal(true);
  protected readonly factorActive = signal(true);
  protected readonly from = signal(80);
  protected readonly to = signal(240);
  protected readonly farbe = signal<string>(OBJECT_COLOURS[0]);
  protected readonly colourTone = signal<string | null>(OBJECT_COLOURS[1]);
  protected readonly fieldValue = signal('');
  protected readonly searchValue = signal('Steinpilz');
  protected readonly yearFrom = signal(4);
  protected readonly yearTo = signal(10);
  protected readonly speciesChoice = signal<string | null>(LATIN_NAMES[0]);
  protected readonly photoFiles = signal<readonly File[]>([this.sampleFile()]);
  protected readonly overlayOpen = signal(true);
  protected readonly filterSheetOpen = signal(true);

  protected readonly objectMenuTarget: ObjectMenuTarget = { x: 90, y: 60 };

  protected readonly navTabs = { map: '/karte', species: '/arten', entries: '/eintraege' };

  protected readonly viewModes = [
    { value: 'vorhersage', label: this.text('map.tab.forecast') },
    { value: 'ebene', label: this.text('map.tab.layer') },
    { value: 'kombination', label: this.text('map.tab.combination') },
  ];

  protected readonly directions = [
    { value: 'from', label: this.text('common.from') },
    { value: 'to', label: this.text('common.to') },
  ];

  protected readonly fourWayOptions = [
    { value: 'select', label: this.text('common.select') },
    { value: 'edit', label: this.text('common.edit') },
    { value: 'remove', label: this.text('common.remove') },
    { value: 'close', label: this.text('common.close') },
  ];

  protected readonly lockedOptions = [
    { value: 'liste', label: this.text('map.combination.list') },
    { value: 'karte', label: this.text('nav.tab.map') },
  ];

  protected readonly speciesChips = [
    { value: 'alle', label: this.text('common.all') },
    { value: 'vorhersage', label: this.text('map.tab.forecast') },
    { value: 'geschuetzt', label: this.text('species.badge.protected') },
  ];

  protected readonly filterChips = [
    this.text('filter.group.hutform'),
    this.text('filter.group.smellTaste'),
    this.text('filter.group.treePartner'),
  ];

  protected readonly colourSwatches = OBJECT_COLOURS.map((value, i) => ({
    value,
    label: `${this.text('common.colour')} ${i + 1}`,
  }));

  protected readonly colourPickerSwatches = OBJECT_COLOURS.map((value, i) => ({
    value,
    label: `${this.text('common.colour')} ${i + 1}`,
  }));

  protected readonly speciesRows = [
    {
      value: LATIN_NAMES[0],
      name: this.text('art.boletus_edulis'),
      latin: LATIN_NAMES[0],
      levelText: this.text('art.essbar.essbar'),
      levelColour: 'var(--color-success)',
      image: null,
    },
    {
      value: LATIN_NAMES[1],
      name: this.text('art.pfifferling'),
      latin: LATIN_NAMES[1],
      levelText: this.text('art.essbar.essbar'),
      levelColour: 'var(--color-success)',
      image: null,
    },
    {
      value: LATIN_NAMES[3],
      name: this.text('art.hexen_flock'),
      latin: LATIN_NAMES[3],
      levelText: this.text('art.essbar.toedlichGiftig'),
      levelColour: 'var(--color-danger)',
      image: null,
    },
  ];

  protected readonly entries = [
    {
      title: this.text('art.boletus_edulis'),
      meta: this.text('beispiel.fund.steinpilzMeta'),
      note: this.text('beispiel.notiz'),
    },
    {
      title: this.text('art.pfifferling'),
      meta: this.text('beispiel.fund.pfifferlingMeta'),
    },
  ];

  protected readonly factor = {
    name: this.text('beispiel.faktor.niederschlag'),
    range: this.text('beispiel.faktor.niederschlagUnter'),
    condition: this.text('beispiel.faktor.niederschlagBedingung'),
  };

  protected readonly lockedFactor = {
    name: this.text('beispiel.faktor.buche'),
    condition: this.text('beispiel.faktor.bucheBedingung'),
  };

  protected readonly stats = [
    { value: 12, label: this.text('entry.finds') },
    { value: 4, label: this.text('entry.markers') },
    { value: 2, label: this.text('entry.zones') },
  ];

  protected readonly measurementRows = [
    { extent: 'width' as const, spans: this.capWidthSpans, unit: this.text('unit.cm') },
    { extent: 'length' as const, spans: this.sporeLengthSpans, unit: this.text('unit.um') },
  ];

  protected readonly monthMarks = [
    { text: this.text('art.monat.jan'), week: 1 },
    { text: this.text('art.monat.apr'), week: 14 },
    { text: this.text('art.monat.jul'), week: 27 },
    { text: this.text('art.monat.okt'), week: 40 },
  ];

  protected readonly colourChangeTriggers = [this.text('art.verfaerbung.zeile')];
  protected readonly colourChangeFrom = [this.fleshColours];
  protected readonly colourChangeTo = [this.bruiseColours];
  protected readonly colourChangeFromLabels = [this.text('art.farbe.fleisch')];
  protected readonly colourChangeToLabels = [this.text('art.abschnitt.farbe')];
  protected readonly colourChangeSpeed = [this.text('art.verfaerbung.schnell')];

  protected readonly confirmDialogMeta = `${this.entries.length} ${this.text('entry.finds')}`;
  protected readonly overlayText = this.text('common.filter');
  protected readonly splitRailLabel = this.text('nav.tab.species');
  protected readonly splitContentText = this.text('species.notFound');
  protected readonly infiniteRows = LATIN_NAMES;

  constructor() {
    afterNextRender(() => {
      this.applyTheme();
    });
  }

  protected text(schluessel: Parameters<I18nService['translate']>[0]): string {
    return this.i18n.translate(schluessel);
  }

  private sampleFile(): File {
    return new File(['x'], 'pilz.jpg', { type: 'image/jpeg' });
  }

  /** Kopiert die Theme-Regeln des Kits auf beide Felder. Ein gesperrtes Stilblatt überspringt der Code. */
  private applyTheme(): void {
    let light = '';
    let dark = '';
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule) || !rule.selectorText.includes('data-theme')) continue;
        if (rule.selectorText.includes('dark')) dark += rule.style.cssText;
        else if (rule.selectorText.includes('light')) light += rule.style.cssText;
      }
    }
    this.lightPane().nativeElement.style.cssText = light;
    this.darkPane().nativeElement.style.cssText = dark;
  }
}
