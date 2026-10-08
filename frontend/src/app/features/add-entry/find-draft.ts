import type { Visibility } from '../../core/api/models';

/** The choices in the find form that are not sent yet. The flow keeps them while the person sets the location again. */
export interface FindDraft {
  readonly slug: string | null;
  readonly visibility: Visibility | null;
  /** `undefined` means no choice, `null` means no group. */
  readonly group: string | null | undefined;
  readonly date: string | null;
  readonly count: string | null;
  readonly note: string | null;
  readonly photos: readonly File[];
  readonly training: boolean | null;
}

export const EMPTY_FIND_DRAFT: FindDraft = {
  slug: null,
  visibility: null,
  group: undefined,
  date: null,
  count: null,
  note: null,
  photos: [],
  training: null,
};
