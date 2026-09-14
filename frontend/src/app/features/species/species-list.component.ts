import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  viewChildren,
} from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '@stupa-makers/ui-kit';
import type { FacetKey, SpeciesBrief } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { EmptyStateComponent } from '../../ui/empty-state/empty-state.component';
import { FormFieldComponent } from '../../ui/form-field/form-field.component';
import { PageHeaderComponent } from '../../ui/page-header/page-header.component';
import { SpeciesRowComponent, type SpeciesRowSpecies } from '../../ui/species-row/species-row.component';
import { SvgIconComponent } from '../../ui/svg-icon/svg-icon.component';
import { FACET_TEXT } from './facet-labels';
import { SpeciesFilterState } from './filter.state';
import { SpeciesState } from './species.state';
import { EDIBILITY_COLOUR, EDIBILITY_TEXT, LEVEL_RANK } from './labels';

/** Eine abnehmbare Marke über der Liste: sie zeigt eine Gruppe, die filtert. */
interface Mark {
  key: FacetKey;
  text: string;
  label: string;
}

/** Eine Zeile der Liste, fertig für die Vorlage. */
interface Row {
  slug: string;
  active: boolean;
  species: SpeciesRowSpecies;
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
    CardComponent,
    EmptyStateComponent,
    FormFieldComponent,
    PageHeaderComponent,
    SpeciesRowComponent,
    SvgIconComponent,
    TranslatePipe,
  ],
  templateUrl: './species-list.component.html',
  styleUrl: './species-list.component.scss',
})
export class SpeciesListComponent {
  private readonly state = inject(SpeciesState);
  private readonly filter = inject(SpeciesFilterState);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly rowRefs = viewChildren(SpeciesRowComponent);

  protected readonly search = signal('');

  /**
   * Die Marken über der Liste zeigen den Zustand, sie stellen ihn nicht ein.
   * Eingestellt wird im Blatt; sonst wären es wieder Pillen, nur mit mehr
   * Schritten. Passen sie nicht in eine Zeile, folgt „+2“ statt eines Umbruchs.
   */
  protected readonly marks = computed<Mark[]>(() =>
    [...this.filter.values().keys()].map((key) => ({
      key,
      text: this.i18n.translate(FACET_TEXT[key]),
      label: this.i18n.translate('filter.marke.entfernen', {
        gruppe: this.i18n.translate(FACET_TEXT[key]),
      }),
    })),
  );

  protected readonly rows = computed<Row[]>(() => this.build(this.grundmenge()));

  /**
   * Die Arten, die an keiner Bedingung scheitern, sondern nur daran, dass die
   * Quelle zu einem gewählten Merkmal nichts sagt. Sie fallen nicht still
   * heraus: sie stehen abgesetzt unter den Treffern.
   */
  protected readonly unassessable = computed<Row[]>(() =>
    this.build(this.state.filtered()?.unbeurteilbar ?? []),
  );

  protected readonly gapText = computed<string | null>(() => {
    const count = this.unassessable().length;
    if (!count) return null;
    return this.i18n.translate('arten.nichtBeurteilbar', { anzahl: String(count) });
  });

  /**
   * Wie viele Arten die Liste gerade zeigt. Ohne diese Zeile wirkte ein Chip
   * wie tot: die Liste steht nach Stufe, die ersten Zeilen bleiben dieselben,
   * und dass aus 85 Arten 23 wurden, sieht man erst nach langem Scrollen.
   */
  /** Was der Server unter dem Filter liefert. Ohne Filter der ganze Katalog. */
  protected readonly grundmenge = computed<readonly SpeciesBrief[]>(() => this.state.filtered()?.arten ?? []);

  protected readonly countText = computed(() => {
    const gesamt = this.grundmenge().length;
    const filtered = this.rows().length;
    return filtered === gesamt
      ? this.i18n.translate('arten.anzahlAlle', { gesamt })
      : this.i18n.translate('arten.anzahlGefiltert', { gefiltert: filtered, gesamt });
  });

  constructor() {
    effect(() => {
      this.state.loadFiltered(this.filter.query());
    });
  }

  protected openFilter(): void {
    void this.router.navigate(['/arten/filter']);
  }

  protected drop(key: FacetKey): void {
    this.filter.clear(key);
  }

  private build(species: readonly SpeciesBrief[]): Row[] {
    const query = this.search().trim().toLocaleLowerCase();
    const active = this.state.activeSpecies();
    const found = species.filter((art) => this.matches(art, query));
    found.sort(
      (links, right) =>
        LEVEL_RANK[links.stufe] - LEVEL_RANK[right.stufe] || links.name.localeCompare(right.name, 'de'),
    );
    return found.map((art) => this.row(art, art.slug === active));
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

  /** Die Zeile trägt nur noch eine Plakette: den Speisewert, die einzige Warnung. */
  private row(art: SpeciesBrief, active: boolean): Row {
    return {
      slug: art.slug,
      active,
      species: {
        name: art.name,
        latin: art.lateinisch,
        levelText: this.i18n.translate(EDIBILITY_TEXT[art.speisewert]),
        levelColour: EDIBILITY_COLOUR[art.speisewert],
        image: art.titelbild,
      },
    };
  }
}
