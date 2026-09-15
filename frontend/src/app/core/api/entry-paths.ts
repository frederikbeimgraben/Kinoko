/** Die Wege der eigenen Objekte. Der Online-Weg und die Warteschlange teilen sie. */
export const ENTRY_PATHS = {
  find: '/finds',
  marker: '/markers',
  zone: '/zones',
  photo: '/photos',
} as const;

/** Die Objektarten, die ein Gerät anlegt. */
export type EntryKind = keyof typeof ENTRY_PATHS;
