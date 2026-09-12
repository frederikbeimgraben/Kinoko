import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChildren } from '@angular/core';
import { Router } from '@angular/router';
import { BadgeComponent, CardComponent, type BadgeVariant } from '@stupa-makers/ui-kit';
import { EDIBILITIES, type Essbarkeit, type SpeciesBrief, type Tag } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import {
  ChipGroupComponent,
  EmptyStateComponent,
  FormFieldComponent,
  NoteComponent,
  PageHeaderComponent,
  SpeciesRowComponent,
  type Chip,
} from '../../ui';
import { SpeciesState } from './species.state';
import {
  EDIBILITY_BADGE,
  EDIBILITY_DANGER,
  EDIBILITY_TEXT,
  GEFAEHRLICH,
  LEVEL_BADGE,
  LEVEL_RANK,
  PROTECTION_BADGE,
  PROTECTION_SHORT,
  TAG_TEXT,
} from './labels';

/**
 * Der Chip, der auf die sammelbaren Arten einschränkt.
 *
 * Bis D9 war das die Vorgabe und die übrigen 221 Profile standen draußen. Das
 * arbeitete gegen den Zweck der Liste: wer einen Pilz gesehen hat und
 * nachschlägt, weiß vorher nicht, ob er sammelbar ist. „sammelbar“ ist kein
 * Tag einer Art, sondern eine Bedingung an sie.
 */
const CHIP_COLLECTABLE = 'sammelbar';

/** „alle“ zeigt den ganzen Katalog, jeder andere Chip schränkt ein. */
type ChipValue = 'alle' | typeof CHIP_COLLECTABLE | Tag;

/**
 * Die fünf Chips der Mockups. Die Werte sind Enum-Werte des Backends, die
 * Beschriftungen stehen wörtlich in `docs/mockups/Arten.dc.html`.
 */
const CHIPS: readonly { value: ChipValue; label: TranslationKey }[] = [
  { value: 'alle', label: 'arten.chip.alle' },
  { value: 'vorhersage', label: 'arten.chip.mitVorhersage' },
  { value: 'roehrling', label: 'arten.chip.roehrlinge' },
  { value: 'herbst', label: 'arten.chip.herbst' },
  { value: CHIP_COLLECTABLE, label: 'arten.chip.sammelbar' },
];

/** Die Stufen der Essbarkeit als zweite Reihe. „alle“ schränkt nicht ein. */
type LevelFilter = 'alle' | Essbarkeit;

/** Ein Tag unter dem Namen einer Art. */
interface Marke {
  text: string;
  variant: BadgeVariant;
}

/** Eine Zeile der Liste, fertig für die Vorlage. */
interface Row {
  slug: string;
  name: string;
  latin: string;
  active: boolean;
  badges: Marke[];
  /** Das Titelbild der Art. Ohne Bild bleibt rechts in der Zeile nichts. */
  image: string | null;
}

/**
 * Der Reiter Arten: Suche, Chips und die Liste mit dem Titelbild. Die Kurve
 * steht seit D10 nur noch auf der Artseite: auf 86 Pixeln liest sie niemand
 * ab. Der
 * Katalog kommt einmal vom Server; Suche und Chips filtern im Speicher, weil
 * 85 Arten keine Anfrage je Tastendruck wert sind.
 *
 * Die Liste steht nach Stufe, innerhalb nach Namen. So stehen unter „alle“ die
 * 23 Arten mit Vorhersage oben, statt zwischen 62 Profilen verstreut. Die
 * aktive Art bleibt an ihrem Platz, sonst spränge die Liste beim Auswählen.
 */
@Component({
  selector: 'app-species',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeComponent,
    CardComponent,
    ChipGroupComponent,
    EmptyStateComponent,
    FormFieldComponent,
    NoteComponent,
    PageHeaderComponent,
    SpeciesRowComponent,
    TranslatePipe,
  ],
  templateUrl: './species-list.component.html',
  styleUrl: './species-list.component.scss',
})
export class SpeciesListComponent {
  private readonly state = inject(SpeciesState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly rowRefs = viewChildren(SpeciesRowComponent);

  protected readonly search = signal('');
  protected readonly chip = signal<ChipValue>('alle');
  protected readonly edibility = signal<LevelFilter>('alle');

  protected readonly chips = computed<Chip[]>(() =>
    CHIPS.map((chip) => ({ value: chip.value, label: this.i18n.translate(chip.label) })),
  );

  protected readonly edibilityChips = computed<Chip[]>(() => [
    { value: 'alle', label: this.i18n.translate('arten.chip.jedeStufe') },
    ...EDIBILITIES.map((level) => ({
      value: level,
      label: this.i18n.translate(EDIBILITY_TEXT[level]),
    })),
  ]);

  protected readonly rows = computed<Row[]>(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const chip = this.chip();
    const active = this.state.activeSpecies();
    // `filter` gibt schon eine eigene Liste zurück; `sort` rührt den Zustand nicht an.
    const level = this.edibility();
    const filtered = this.grundmenge()
      .filter((art) => (chip === CHIP_COLLECTABLE ? art.sammelbar : true))
      .filter((art) => chip === 'alle' || chip === CHIP_COLLECTABLE || art.tags.includes(chip))
      .filter((art) => level === 'alle' || art.speisewert === level)
      .filter((art) => this.matches(art, query));
    // Sucht jemand nach einer Stufe der Essbarkeit, führt die Gefahr: wer nach
    // „tödlich giftig“ filtert, sucht das Tödliche und nicht das Alphabet.
    const byDanger = level !== 'alle';
    filtered.sort(
      (links, right) =>
        (byDanger
          ? EDIBILITY_DANGER[links.speisewert] - EDIBILITY_DANGER[right.speisewert]
          : LEVEL_RANK[links.stufe] - LEVEL_RANK[right.stufe]) || links.name.localeCompare(right.name, 'de'),
    );
    return filtered.map((art) => this.row(art, art.slug === active));
  });

  /**
   * Wie viele Arten die Liste gerade zeigt. Ohne diese Zeile wirkte ein Chip
   * wie tot: die Liste steht nach Stufe, die ersten Zeilen bleiben dieselben,
   * und dass aus 85 Arten 23 wurden, sieht man erst nach langem Scrollen.
   */
  /** Ein Topf: der ganze Katalog. Die Chips schränken ihn ein. */
  protected readonly grundmenge = computed<readonly SpeciesBrief[]>(
    () => this.state.catalogue()?.arten ?? [],
  );

  protected readonly countText = computed(() => {
    const gesamt = this.grundmenge().length;
    const filtered = this.rows().length;
    return filtered === gesamt
      ? this.i18n.translate('arten.anzahlAlle', { gesamt })
      : this.i18n.translate('arten.anzahlGefiltert', { gefiltert: filtered, gesamt });
  });

  constructor() {
    this.state.loadCatalogue();
  }

  protected selectChip(value: string): void {
    const chip = CHIPS.find((candidate) => candidate.value === value);
    if (chip) this.chip.set(chip.value);
  }

  protected selectEdibility(value: string): void {
    const level = EDIBILITIES.find((candidate) => candidate === value);
    this.edibility.set(level ?? 'alle');
  }

  protected open(slug: string): void {
    void this.router.navigate(['/arten', slug]);
  }

  /** Pfeil hoch und runter wandern durch die Liste; Enter öffnet die Zeile. */
  protected onKey(event: KeyboardEvent, index: number): void {
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    const rows = this.rowRefs();
    const target = index + step;
    if (target < 0 || target >= rows.length) return;
    event.preventDefault();
    rows[target].focus();
  }

  private matches(art: SpeciesBrief, query: string): boolean {
    if (query === '') return true;
    return art.name.toLocaleLowerCase().includes(query) || art.lateinisch.toLocaleLowerCase().includes(query);
  }

  /**
   * Die Marken einer Zeile, immer in derselben Reihenfolge: Stufe, Schutz,
   * Speisewert, Symbiosepartner, Jahreszeit. Jede steht für einen Filter, nach
   * dem man die Liste auch wirklich durchsuchen kann; vorher standen dort
   * beliebige Tags, die nichts zu tun hatten.
   *
   * Der Speisewert erscheint nur, wo er warnt. „Essbar“ an jeder zweiten Zeile
   * sagt nichts; „Tödlich giftig“ muss ins Auge springen.
   *
   * Und es steht vorn. Die Zeile zeigt nur die ersten zwei oder drei Marken,
   * und der Speisewert stand an dritter Stelle: eine geschützte, tödlich
   * giftige Art verlor ihre Warnung, sobald sie die aktive Art der Karte war.
   * Was hinten steht, darf wegfallen — Baum und Jahreszeit. Die Warnung nie.
   */
  private badges(art: SpeciesBrief): Marke[] {
    const badges: Marke[] = [];
    if (GEFAEHRLICH.includes(art.speisewert)) {
      badges.push({
        text: this.i18n.translate(EDIBILITY_TEXT[art.speisewert]),
        variant: EDIBILITY_BADGE[art.speisewert],
      });
    }
    badges.push({
      text: this.i18n.translate(TAG_TEXT[art.stufe]),
      variant: LEVEL_BADGE[art.stufe],
    });
    if (art.schutz.status !== 'keiner') {
      badges.push({
        text: this.i18n.translate(PROTECTION_SHORT[art.schutz.status]),
        variant: PROTECTION_BADGE[art.schutz.status],
      });
    }
    // Der erste Baum ist der wichtigste: so stehen sie im Profil.
    const tree = art.baeume.at(0) ?? art.baeumeAusErfahrung?.baeume.at(0);
    if (tree) badges.push({ text: this.i18n.translate(TAG_TEXT[tree]), variant: 'neutral' });
    const season = art.jahreszeiten.at(0);
    if (season) {
      badges.push({ text: this.i18n.translate(TAG_TEXT[season]), variant: 'neutral' });
    }
    return badges;
  }

  private row(art: SpeciesBrief, active: boolean): Row {
    // Die Zeile setzt bei einer aktiven Art selbst die Marke „aktiv“ davor,
    // darum bleibt hier eine Marke weniger Platz. Gekürzt wird von hinten, und
    // die Warnung steht vorn: sie ist die einzige Marke, deren Fehlen jemanden
    // vergiften kann.
    return {
      slug: art.slug,
      name: art.name,
      latin: art.lateinisch,
      active,
      badges: this.badges(art).slice(0, active ? 2 : 3),
      image: art.titelbild,
    };
  }
}
