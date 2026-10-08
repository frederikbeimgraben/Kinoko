/** The paths of the user objects. The online requests and the offline queue both use them. */
export const ENTRY_PATHS = {
  find: '/finds',
  marker: '/markers',
  zone: '/zones',
  photo: '/photos',
} as const;

/** The object kinds that a device makes. */
export type EntryKind = keyof typeof ENTRY_PATHS;
