import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ActionBarComponent } from './action-bar.component';

describe('ActionBarComponent', () => {
  it('stellt nur die Hauptaktion auf', async () => {
    const { container, fixture } = await render(ActionBarComponent, {
      inputs: { primary: 'Speichern' },
    });
    let calls = 0;
    fixture.componentInstance.primaryClick.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('stellt Hauptaktion und eine zweite darunter', async () => {
    const { fixture } = await render(ActionBarComponent, {
      inputs: { primary: 'Speichern', secondary: 'Abbrechen' },
    });
    const calls: string[] = [];
    fixture.componentInstance.primaryClick.subscribe(() => calls.push('haupt'));
    fixture.componentInstance.secondaryClick.subscribe(() => calls.push('zweite'));

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(calls).toEqual(['haupt', 'zweite']);
  });

  it('färbt die Hauptaktion rot', async () => {
    const { container } = await render(ActionBarComponent, {
      inputs: { primary: 'Alles löschen', danger: true },
    });

    expect(container.querySelector('.btn--danger')).not.toBeNull();
  });

  it('zeichnet die zweite Löschaktion als Umriss', async () => {
    const { container } = await render(ActionBarComponent, {
      inputs: { primary: 'Übernehmen', secondary: 'Faktor entfernen', secondaryDanger: true },
    });

    expect(container.querySelector('.btn--danger-outline')).not.toBeNull();
    expect(container.querySelector('.btn--danger')).toBeNull();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(ActionBarComponent, {
      inputs: { primary: 'Save', secondary: 'Cancel' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
