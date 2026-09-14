import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '@stupa-makers/ui-kit';
import type { FacetKey } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ActionBarComponent, PageHeaderComponent, SvgIconComponent } from '../../ui';
import { FACET_TEXT, HIDDEN, NOT_YET, SHEET } from './facet-labels';
import { FacetState } from './facet.state';
import { SpeciesFilterState } from './filter.state';
import { SpeciesState } from './species.state';

/** Eine Gruppe im Blatt: Name, Abdeckung, was darin gewählt ist. */
interface GroupRow {
  key: FacetKey;
  name: string;
  /** Nur, wo Arten fehlen. „306 von 306“ sagte auf jeder Zeile dasselbe. */
  coverage: string | null;
  chosen: string | undefined;
}

/** Eine Karte des Blatts mit ihren Gruppen. */
interface SheetCard {
  key: number;
  groups: GroupRow[];
}

/**
 * Das Filterblatt: die Gruppen in drei Karten, wie im Mockup.
 *
 * „Hutform, 94 von 306 beschrieben" heißt: wer danach filtert, schließt 212
 * Arten aus, weil die Angabe fehlt, und nicht weil sie nicht passen. Eine
 * Gruppe, die diese Oberfläche noch nicht wählen lässt, steht nicht im Blatt:
 * eine Zeile, die sich nicht öffnen lässt, ist eine kaputte Zeile.
 */
@Component({
  selector: 'app-species-filter',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ActionBarComponent, CardComponent, PageHeaderComponent, SvgIconComponent, TranslatePipe],
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

  protected readonly cards = computed<SheetCard[]>(() => {
    const catalogue = this.facets.catalogue();
    if (!catalogue) return [];
    const byKey = new Map(catalogue.gruppen.map((group) => [group.schluessel, group]));
    return SHEET.map((keys, index) => ({
      key: index,
      groups: keys.flatMap((key) => {
        const group = byKey.get(key);
        if (!group || NOT_YET.includes(key) || HIDDEN.includes(key)) return [];
        return [
          {
            key,
            name: this.i18n.translate(FACET_TEXT[key]),
            coverage:
              group.beschrieben < catalogue.arten
                ? this.i18n.translate('filter.abdeckung', {
                    beschrieben: String(group.beschrieben),
                    gesamt: String(catalogue.arten),
                  })
                : null,
            chosen: this.chosenText(key),
          },
        ];
      }),
    })).filter((card) => card.groups.length > 0);
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
    void this.router.navigate(['/arten/filter', row.key]);
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
