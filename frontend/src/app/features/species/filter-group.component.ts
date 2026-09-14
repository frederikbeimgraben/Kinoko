import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { CardComponent } from '@stupa-makers/ui-kit';
import { FACET_KEYS, type FacetKey, type FacetValue } from '../../core/api/models';
import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import type { TranslationKey } from '../../core/i18n/translations';
import { ActionBarComponent, CheckRowComponent, EmptyStateComponent, PageHeaderComponent } from '../../ui';
import { FACET_TEXT, valueKey } from './facet-labels';
import { FacetState } from './facet.state';
import { SpeciesFilterState } from './filter.state';
import { SpeciesState } from './species.state';

/** Ein wählbarer Wert mit seiner Zahl. */
interface ValueRow {
  value: string;
  name: string;
  count: string;
  chosen: boolean;
}

/** Die Teile, die eine Gruppe haben kann. */
const PART_TEXT: Readonly<Record<string, TranslationKey>> = {
  geruch: 'filter.teil.geruch',
  geschmack: 'filter.teil.geschmack',
  art: 'filter.teil.art',
  ansatz: 'filter.teil.ansatz',
  stand: 'filter.teil.stand',
  schneide: 'filter.teil.schneide',
};

/** Ein Teil einer Gruppe, etwa Geruch neben Geschmack. */
interface PartRow {
  name: string;
  values: ValueRow[];
}

interface Viewport {
  name: string;
  parts: PartRow[];
  gap: string | null;
  keeps: boolean;
}

/**
 * Eine Gruppe des Filters: die Werte mit ihrer Zahl, und der Schalter für die
 * Arten ohne Angabe.
 *
 * Die Zahl am Wert ist absolut über den ganzen Katalog. Sie sagt, was eine
 * Wahl kostet, bevor jemand sie trifft; was danach übrig bleibt, steht im Fuß.
 */
@Component({
  selector: 'app-species-filter-group',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ActionBarComponent,
    CardComponent,
    CheckRowComponent,
    EmptyStateComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './filter-group.component.html',
  styleUrl: './filter-group.component.scss',
})
export class SpeciesFilterGroupComponent {
  private readonly facets = inject(FacetState);
  private readonly filter = inject(SpeciesFilterState);
  private readonly species = inject(SpeciesState);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly gruppe = input.required<string>();

  constructor() {
    effect(() => {
      if (this.knownKey()) this.facets.load();
    });
    // Der Fuss nennt, wie viele Arten die Auswahl uebrig laesst.
    effect(() => {
      this.species.loadFiltered(this.filter.query());
    });
  }

  protected knownKey(): FacetKey | null {
    const asked = this.gruppe();
    return FACET_KEYS.find((known) => known === asked) ?? null;
  }

  protected readonly viewport = computed<Viewport | null>(() => {
    const key = this.knownKey();
    const group = key ? this.facets.groupOf(key) : null;
    if (!key || !group) return null;
    const parts = group.teile.length
      ? group.teile.map((part) => ({
          name: this.i18n.translate(PART_TEXT[part.teil] ?? 'filter.titel'),
          values: this.rows(key, part.teil, part.werte),
        }))
      : [{ name: '', values: this.rows(key, '', group.werte) }];
    const missing = this.facets.total() - group.beschrieben;
    return {
      name: this.i18n.translate(FACET_TEXT[key]),
      parts,
      gap: missing
        ? this.i18n.translate('filter.luecke', {
            anzahl: String(missing),
            gesamt: String(this.facets.total()),
          })
        : null,
      keeps: this.filter.keeps(key),
    };
  });

  protected readonly hits = computed<string>(() => {
    const found = this.species.filtered()?.arten.length ?? 0;
    if (found === 1) return this.i18n.translate('filter.eineAnzeigen');
    return this.i18n.translate('filter.anzeigen', { anzahl: String(found) });
  });

  protected back(): void {
    void this.router.navigate(['/arten/filter']);
  }

  protected pick(value: string): void {
    const key = this.knownKey();
    if (key) this.filter.toggle(key, value);
  }

  protected keepUnknown(): void {
    const key = this.knownKey();
    if (key) this.filter.toggleKeepUnknown(key);
  }

  private rows(key: FacetKey, part: string, values: readonly FacetValue[]): ValueRow[] {
    const chosen = this.filter.chosenIn(key);
    return values.map((value) => ({
      value: value.wert,
      name: this.valueName(key, part, value.wert),
      count: String(value.anzahl),
      chosen: chosen.has(value.wert),
    }));
  }

  /** Ohne Schlüssel steht der Wert selbst da. Das fällt auf, eine Lücke nicht. */
  private valueName(key: FacetKey, part: string, value: string): string {
    if (key === 'wertigkeit') return this.i18n.translate('filter.wertigkeitStufe', { stufe: value });
    const found = valueKey(key, part, value);
    return found ? this.i18n.translate(found) : value;
  }
}
