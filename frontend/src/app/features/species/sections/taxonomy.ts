const UMLAUTS: Readonly<Record<string, string>> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

/** Der Slug einer Stufe aus ihrem lateinischen Namen, wie ihn das Backend führt. */
export function taxonSlug(name: string): string {
  const plain = name.toLowerCase().replace(/[äöüß]/g, (one) => UMLAUTS[one] ?? one);
  return plain
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
