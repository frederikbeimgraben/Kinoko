/** Die Kennung eines Begriffs kommt aus seinem Namen. */

const UMLAUTS: Readonly<Record<string, string>> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
};

export function slugOf(name: string): string {
  return name
    .toLocaleLowerCase()
    .replace(/[äöüß]/g, (letter) => UMLAUTS[letter])
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
