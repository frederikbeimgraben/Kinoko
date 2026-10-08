const UMLAUTS: Readonly<Record<string, string>> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** The slug of a rank from its Latin name, in the same format as the backend. */
export function taxonSlug(name: string): string {
  const plain = name.toLowerCase().replace(/[äöüß]/g, (one) => UMLAUTS[one] ?? one);
  return plain
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
