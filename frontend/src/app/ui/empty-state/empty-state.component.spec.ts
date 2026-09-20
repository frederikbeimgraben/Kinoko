import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  it('zeigt Bild und Satz, mittig und ohne Kasten', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Keine Art passt zur Suche.' },
    });

    expect(screen.getByText('Keine Art passt zur Suche.')).toBeInTheDocument();
    expect(container.querySelector('.empty__badge svg')).not.toBeNull();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('nimmt ein eigenes Bild an', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Noch kein Fund.', icon: 'entries' },
    });

    expect(container.querySelector('.empty__badge')).not.toBeNull();
  });

  it('stellt Bild, Satz und Handlung in dieser Reihenfolge', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Eigene Einträge stehen im Konto.', action: 'Anmelden' },
    });

    // `querySelectorAll` gibt die Reihenfolge im Baum zurück.
    const order = [...container.querySelectorAll('.empty__badge, .empty__text, .empty__button')].map((part) =>
      part.className.split(' ').find((cssClass) => cssClass.startsWith('empty__')),
    );
    expect(order).toEqual(['empty__badge', 'empty__text', 'empty__button']);
  });

  it('setzt das Bild in ein rundes Abzeichen von 56 px', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'Für diese Art gibt es noch kein Bild.' },
    });

    const badge = container.querySelector('.empty__badge');
    if (badge === null) throw new Error('Das Abzeichen steht nicht im Baum.');
    const style = getComputedStyle(badge);
    expect(style.getPropertyValue('inline-size')).toBe('56px');
    expect(style.getPropertyValue('block-size')).toBe('56px');
    expect(style.borderRadius).toBe('50%');
  });

  it('führt mit einem eigenen Knopf hinaus, nicht mit dem des Kits', async () => {
    const { container, fixture } = await render(EmptyStateComponent, {
      inputs: { text: 'Eigene Einträge stehen im Konto.', action: 'Anmelden' },
    });
    let calls = 0;
    fixture.componentInstance.actionClick.subscribe(() => (calls += 1));
    const button = screen.getByRole('button', { name: 'Anmelden' });

    await userEvent.click(button);

    expect(calls).toBe(1);
    expect(container.querySelector('app-push-button')).toBeNull();
    expect(button).toHaveClass('empty__button', 'tap');
    expect(button).toHaveAttribute('data-press', 'scale');
  });

  it('führt mit dem gefüllten Knopf des Kits, wenn die Handlung das Hauptziel ist', async () => {
    const { container, fixture } = await render(EmptyStateComponent, {
      inputs: {
        text: 'Ohne Anmeldung keine eigenen Einträge',
        action: 'Anmelden',
        primaryAction: true,
      },
    });
    let calls = 0;
    fixture.componentInstance.actionClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Anmelden' }));

    expect(calls).toBe(1);
    expect(container.querySelector('app-push-button')).not.toBeNull();
    expect(container.querySelector('.empty__button')).toBeNull();
  });

  it('bleibt ohne deutschen Text im leeren Katalog', async () => {
    const { container } = await render(EmptyStateComponent, {
      inputs: { text: 'no match', action: 'reset' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
