/** Die Begriffe der Bretter Glossary, AdminGlossary und GlossaryEdit. */

const STAMP = '2026-09-12T10:00:00Z';

function entry(id: string, term: string, definition: string): Record<string, unknown> {
  return { id, term, definition, updatedByName: 'Frederik', updatedAt: STAMP };
}

export const GLOSSARY = [
  entry(
    'begriff-eins',
    'Hymenium',
    'Die sporenbildende Schicht der Fruchtschicht, bei vielen Arten unter dem Hut.',
  ),
  entry(
    'begriff-zwei',
    'Lamellen',
    'Blattartige Strukturen unter dem Hut, tragen das Hymenium vieler Blätterpilze.',
  ),
  entry(
    'begriff-drei',
    'Röhren',
    'Schwammartige Fruchtschicht mancher Röhrlinge, aus dicht stehenden Röhrchen.',
  ),
  entry('begriff-vier', 'Velum', 'Schutzhülle des jungen Fruchtkörpers, bildet später Ring oder Volva.'),
  entry(
    'begriff-fuenf',
    'Mykorrhiza',
    'Symbiose zwischen Pilzgeflecht und Baumwurzel, von Vorteil für beide.',
  ),
];
