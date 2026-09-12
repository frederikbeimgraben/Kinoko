import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '@stupa-makers/ui-kit';
import type { FacetKey } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent, ListRowComponent, NoteComponent, PageHeaderComponent } from '../../ui';
import { FACET_TEXT, NOT_YET } from './facet-labels';
import { FacetState } from './facet.state';
import { SpeciesFilterState } from './filter.state';
import { SpeciesState } from './species.state';

/** Eine Gruppe im Blatt: Name, Abdeckung, was darin gewählt ist. */
interface GroupRow {
  key: FacetKey;
  name: string;
  coverage: string;
  chosen: string | undefined;
  ready: boolean;
}

/**
 * Das Filterblatt: alle Gruppen mit ihrer Abdeckung, bevor jemand wählt.
 *
 * „Hutform, 94 von 306 beschrieben" heißt: wer danach filtert, schließt 212
 * Arten aus, weil die Angabe fehlt, und nicht weil sie nicht passen. Die
 * Gruppen stehen nach Abdeckung, die dichteste zuerst — wer nach unten liest,
 * sieht an den Zahlen selbst, dass es dünner wird.
 */
@Component({
  selector: 'app-species-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CardComponent,
    ListRowComponent,
    NoteComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './filter.component.html',
  styleUrl: './filter.component.scss',
})
export class SpeciesFilterComponent {
  private readonly facets = inject(FacetState);
  private readonly filter = inject(SpeciesFilterState);
  private readonly species = inject(SpeciesState);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  constructor() {
    this.facets.load();
    // Der Fuss nennt, wie viele Arten die Auswahl uebrig laesst. Die Zahl
    // kommt aus derselben Liste wie der Reiter Arten, damit sie nicht
    // auseinanderlaufen.
    effect(() => {
      this.species.loadFiltered(this.filter.query());
    });
  }

  protected readonly any = this.filter.any;

  protected readonly groups = computed<GroupRow[]>(() => {
    const catalogue = this.facets.catalogue();
    if (!catalogue) return [];
    return catalogue.gruppen.map((group) => ({
      key: group.schluessel,
      name: this.i18n.translate(FACET_TEXT[group.schluessel]),
      coverage: this.i18n.translate('filter.abdeckung', {
        beschrieben: String(group.beschrieben),
        gesamt: String(catalogue.arten),
      }),
      chosen: this.chosenText(group.schluessel),
      ready: !NOT_YET.includes(group.schluessel),
    }));
  });

  /** Was der Fuß nennt: wie viele Arten die Auswahl gerade übrig lässt. */
  protected readonly hits = computed<string>(() => {
    const found = this.species.filtered()?.arten.length ?? 0;
    if (found === 1) return this.i18n.translate('filter.eineAnzeigen');
    return this.i18n.translate('filter.anzeigen', { anzahl: String(found) });
  });

  protected back(): void {
    void this.router.navigate(['/arten']);
  }

  protected open(row: GroupRow): void {
    if (row.ready) void this.router.navigate(['/arten/filter', row.key]);
  }

  protected reset(): void {
    this.filter.clearAll();
  }

  private chosenText(key: FacetKey): string | undefined {
    const chosen = this.filter.chosenIn(key);
    if (chosen.size === 0) return undefined;
    if (chosen.size === 1) return [...chosen][0];
    return this.i18n.translate('filter.gewaehlt', { anzahl: String(chosen.size) });
  }
}
