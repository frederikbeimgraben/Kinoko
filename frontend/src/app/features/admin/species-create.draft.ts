import type { Edibility, Group, SpeciesWrite } from '../../core/api/models';

/** Die Felder, die das Formular zum Anlegen einer Art führt. */
export interface SpeciesDraft {
  name: string;
  scientificName: string;
  otherNames: string;
  group: Group;
  edibility: Edibility;
  protected: boolean;
  source: string;
}

export const EMPTY_DRAFT: SpeciesDraft = {
  name: '',
  scientificName: '',
  otherNames: '',
  group: 'bolete',
  edibility: 'edible',
  protected: false,
  source: '',
};

/** Der Titel einer Quelle ist ihr Rechnername ohne `www.`. */
export function sourceTitle(url: string): string {
  const trimmed = url.trim();
  if (trimmed === '') return '';
  const host = /^(?:[a-z]+:\/\/)?(?:www\.)?([^/?#]+)/i.exec(trimmed);
  return host === null ? trimmed : host[1];
}

/** Die weiteren Namen stehen in einer Zeile, am Komma getrennt. */
function otherNames(value: string): SpeciesWrite['names'] {
  return value
    .split(',')
    .map((one) => one.trim())
    .filter((one) => one !== '')
    .map((name) => ({ name, kind: 'synonym' as const }));
}

/** Formt die Eingaben in den Körper des Vertrags. */
export function toWrite(draft: SpeciesDraft, checkedOn: string): SpeciesWrite {
  const url = draft.source.trim();
  return {
    name: draft.name.trim(),
    scientificName: draft.scientificName.trim(),
    group: draft.group,
    edibility: draft.edibility,
    protection: draft.protected ? 'personal_use' : 'none',
    names: otherNames(draft.otherNames),
    sources: url === '' ? [] : [{ scope: 'profile', title: sourceTitle(url), url, checkedOn }],
  };
}
