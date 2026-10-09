import { computed, type Signal } from '@angular/core';
import type { SpeciesEditorStore } from './species-editor.store';

/** A field value that a section page keeps in the editor store until it applies or closes. */
export type DraftField<T> = Signal<T> & { set(value: T): void };

/** Gives the draft of `key`, or the stored value while there is no draft.
 * The draft stays when a sub-editor opens, so the page shows it again on return. */
export function draftField<T>(store: SpeciesEditorStore, key: () => string, stored: () => T): DraftField<T> {
  const value = computed(() => {
    const drafts = store.drafts();
    const name = key();
    return name in drafts ? (drafts[name] as T) : stored();
  });
  return Object.assign(value, {
    set: (next: T): void => {
      store.setDraft(key(), next);
    },
  });
}
