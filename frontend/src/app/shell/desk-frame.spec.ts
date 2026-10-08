import { describe, expect, it } from 'vitest';
import { deskFrame, paneWidth } from './desk-frame';

describe('deskFrame', () => {
  it.each([
    ['/karte', 'panel', false],
    ['/arten', 'middle', true],
    ['/taxonomie', 'middle', false],
    ['/eintraege', 'list', false],
    ['/konto', 'list', false],
    ['/verwaltung', 'own', true],
    ['/anmeldung', 'list', false],
  ])('%s has the pane %s, full %s', (section, pane, full) => {
    expect(deskFrame(section)).toEqual({ pane, full });
  });

  it('keeps the base column width for a section with its own columns', () => {
    expect(paneWidth('own')).toBeNull();
    expect(paneWidth('panel')).toBe('var(--w-pane-panel)');
  });
});
