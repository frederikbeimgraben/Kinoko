import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { SafetyNoticeComponent } from './safety-notice.component';

describe('SafetyNoticeComponent', () => {
  it('shows the safety notice as a note', async () => {
    const { container } = await render(SafetyNoticeComponent);

    const note = screen.getByRole('note');
    expect(note).toHaveTextContent('keine Bestimmungshilfe für den Verzehr');
    expect(note).toHaveTextContent('Giftnotruf');
    await noViolations(container);
  });

  it('keeps no German word with an empty catalogue', async () => {
    const { container } = await render(SafetyNoticeComponent, { providers: [EMPTY_CATALOG] });

    noGermanText(container);
  });
});
