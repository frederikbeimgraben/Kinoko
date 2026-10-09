import { Injectable, inject } from '@angular/core';
import type { StandardColour, TermKind } from '../../core/api/models';
import { DEFAULT_LOCALE } from '../../core/i18n/translations';
import { I18nService } from '../../core/i18n/i18n.service';
import { taxonSlug } from './sections/taxonomy';
import { SpeciesStore } from './species.store';

/** A colour of the catalogue: its German name and the hex of the nearest standard colour. */
export interface NamedColour {
  readonly name: string;
  readonly nearest?: string | null;
}

/** A term of the catalogue: the slug is the key of its text, the name is the German text. */
export interface NamedTerm {
  readonly kind: TermKind;
  readonly slug: string;
  readonly name: string;
}

/** The names of catalogue values in the language of the interface. */
export interface CatalogueNames {
  colour(value: NamedColour): string;
  term(value: NamedTerm): string;
  /** A free German text of the catalogue in German, else the fallback. */
  free(german: string, fallback: string): string;
}

/** The catalogue stores German names; in German they show as an editor wrote them. In another language,
 * a colour and a term take the text of their slug. A new colour takes the name of its nearest standard colour. */
export function catalogueNames(i18n: I18nService, palette: () => readonly StandardColour[]): CatalogueNames {
  const german = (): boolean => i18n.locale() === DEFAULT_LOCALE;
  const lookup = (key: string, fallback: string): string => {
    const text = i18n.translateOptional(key);
    return text === key ? fallback : text;
  };
  return {
    colour: (value) => {
      if (german()) return value.name;
      const standard = palette().find((one) => one.hex === value.nearest);
      const near = standard ? lookup(`enum.colour.${standard.key}`, value.name) : value.name;
      return lookup(`colour.name.${taxonSlug(value.name)}`, near);
    },
    term: (value) => (german() ? value.name : lookup(`term.${value.kind}.${value.slug}`, value.name)),
    free: (text, fallback) => (german() || fallback === '' ? text : fallback),
  };
}

/** {@link CatalogueNames} with the language of the app and the palette of the catalogue. */
@Injectable({ providedIn: 'root' })
export class CatalogueText implements CatalogueNames {
  private readonly names = catalogueNames(inject(I18nService), inject(SpeciesStore).palette);

  colour(value: NamedColour): string {
    return this.names.colour(value);
  }

  term(value: NamedTerm): string {
    return this.names.term(value);
  }

  free(german: string, fallback: string): string {
    return this.names.free(german, fallback);
  }
}
