import { grouped } from './numbers';

/** The values of the placeholders in a text. */
export type TextParams = Readonly<Record<string, string | number>>;

const PLURAL_START = /\{(\w+)\s*,\s*plural\s*,/g;
const SELECTOR = /^\s*(=\d+|zero|one|two|few|many|other)\s*\{/;

/** The index of the brace that closes the brace at `open`, or -1. */
function closing(text: string, open: number): number {
  let depth = 0;
  for (let index = open; index < text.length; index++) {
    if (text[index] === '{') depth++;
    else if (text[index] === '}' && --depth === 0) return index;
  }
  return -1;
}

/** The branches of a plural body, `one {…} other {…}`, by selector. */
function branches(body: string): ReadonlyMap<string, string> {
  const found = new Map<string, string>();
  let rest = body;
  for (let match = SELECTOR.exec(rest); match !== null; match = SELECTOR.exec(rest)) {
    const open = match[0].length - 1;
    const end = closing(rest, open);
    if (end < 0) break;
    found.set(match[1], rest.slice(open + 1, end));
    rest = rest.slice(end + 1);
  }
  return found;
}

/** A count from a parameter. A formatted count such as `1 284` is also a count. */
function countOf(value: string | number | undefined): number | null {
  if (typeof value === 'number') return value;
  if (value === undefined) return null;
  const number = Number(value.replace(/\s/g, ''));
  return Number.isFinite(number) ? number : null;
}

function choose(found: ReadonlyMap<string, string>, count: number | null, rules: Intl.PluralRules): string {
  if (count === null) return found.get('other') ?? '';
  return found.get(`=${String(count)}`) ?? found.get(rules.select(count)) ?? found.get('other') ?? '';
}

/** Resolves the ICU plural forms in a text, `{count, plural, one {# Fund} other {# Funde}}`.
 * The `#` gives the count. A plural without its parameter keeps the `other` form. */
export function plurals(text: string, params: TextParams, locale: string): string {
  const rules = new Intl.PluralRules(locale);
  PLURAL_START.lastIndex = 0;
  const match = PLURAL_START.exec(text);
  if (match === null) return text;
  const end = closing(text, match.index);
  if (end < 0) return text;
  const name = match[1];
  const value = name in params ? params[name] : undefined;
  const count = countOf(value);
  const shown = typeof value === 'number' ? grouped(value) : (value ?? '#');
  const form = choose(branches(text.slice(match.index + match[0].length, end)), count, rules).replaceAll(
    '#',
    shown,
  );
  return plurals(text.slice(0, match.index) + form + text.slice(end + 1), params, locale);
}
