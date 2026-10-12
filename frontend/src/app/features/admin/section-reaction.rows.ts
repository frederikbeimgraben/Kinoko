import type { ReactionSource, SpeciesEntry, SpeciesReaction } from '../../core/api/models';

/** The reactions of the species, an empty list before it loads. */
export function reactionsOf(species: SpeciesEntry | null): SpeciesReaction[] {
  return species?.reactions ?? [];
}

/** The reaction at a position, or null for a new one. */
export function reactionAt(species: SpeciesEntry | null, at: number): SpeciesReaction | null {
  return reactionsOf(species).find((_, index) => index === at) ?? null;
}

/** Puts the reaction at its position. A position after the last adds it. */
export function withReaction(
  species: SpeciesEntry | null,
  at: number,
  reaction: SpeciesReaction,
): SpeciesReaction[] {
  const held = reactionsOf(species);
  return at < held.length ? held.map((one, index) => (index === at ? reaction : one)) : [...held, reaction];
}

export function withoutReaction(species: SpeciesEntry | null, at: number): SpeciesReaction[] {
  return reactionsOf(species).filter((_, index) => index !== at);
}

/** The sources without empty rows. A source needs a title; address and year can be empty. */
export function cleanSources(sources: readonly ReactionSource[]): ReactionSource[] {
  const text = (value: string | null): string | null => {
    const trimmed = value?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
  };
  return sources
    .filter((one) => one.label.trim() !== '')
    .map((one) => ({ label: one.label.trim(), url: text(one.url), year: text(one.year) }));
}
