import axe from 'axe-core';

/** Regeln, die für einen Ausschnitt nicht gelten. Die Seite prüft sie. */
const PAGE_RULES = ['region', 'page-has-heading-one', 'landmark-one-main'];

/** Prüft einen Ausschnitt mit axe. `extraOff` schaltet weitere Regeln ab. */
export async function noViolations(element: Element, extraOff: readonly string[] = []): Promise<void> {
  const rules: Record<string, { enabled: boolean }> = {};
  for (const rule of [...PAGE_RULES, ...extraOff]) rules[rule] = { enabled: false };
  const result = await axe.run(element, { rules });
  if (result.violations.length > 0) {
    const text = result.violations
      .map((violation) => `${violation.id}: ${violation.help} (${String(violation.nodes.length)})`)
      .join('\n');
    throw new Error(`axe hat Verstöße gefunden:\n${text}`);
  }
}
