import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  it('stellt Frage und die roten Löschen-/Abbrechen-Knöpfe', async () => {
    const { container, fixture } = await render(ConfirmDialogComponent, {
      inputs: { open: true, title: 'Fund löschen?' },
    });
    const calls: string[] = [];
    fixture.componentInstance.confirmed.subscribe(() => calls.push('bestaetigt'));
    fixture.componentInstance.cancelled.subscribe(() => calls.push('abgebrochen'));

    expect(screen.getByRole('dialog', { name: 'Fund löschen?' })).toBeInTheDocument();
    expect(container.querySelector('.btn.textdanger')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Löschen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(calls).toEqual(['bestaetigt', 'abgebrochen']);
    await noViolations(container);
  });

  it('stellt Abbrechen vor die Bestätigung', async () => {
    const { container } = await render(ConfirmDialogComponent, {
      inputs: { open: true, title: 'Fund löschen?' },
    });

    const labels = [...container.querySelectorAll('.confirm__actions button')].map((button) =>
      button.textContent.trim(),
    );
    expect(labels).toEqual(['Abbrechen', 'Löschen']);
  });

  it('stellt die Knöpfe gestapelt, wenn der Stapel verlangt ist', async () => {
    const { container } = await render(ConfirmDialogComponent, {
      inputs: { open: true, title: '', stack: true, danger: false, confirmLabel: 'Anmelden' },
    });

    expect(container.querySelector('.confirm__actions--stack')).not.toBeNull();
    const labels = [...container.querySelectorAll('.confirm__actions button')].map((button) =>
      button.textContent.trim(),
    );
    expect(labels).toEqual(['Anmelden', 'Abbrechen']);
    expect(container.querySelector('.btn.primary')).not.toBeNull();
    expect(container.querySelector('h2')).toBeNull();
  });

  it('zeigt die Zahl als Kontext unter der Frage', async () => {
    await render(ConfirmDialogComponent, {
      inputs: { open: true, title: 'Steinpilz löschen?', meta: '14 Funde · Karte vorhanden' },
    });

    expect(screen.getByText('14 Funde · Karte vorhanden')).toBeInTheDocument();
  });

  it('färbt die Bestätigung grün, wenn sie nicht gefährlich ist', async () => {
    const { container } = await render(ConfirmDialogComponent, {
      inputs: { open: true, title: 'Training starten?', danger: false, confirmLabel: 'Starten' },
    });

    expect(screen.getByRole('button', { name: 'Starten' })).toBeInTheDocument();
    expect(container.querySelector('.btn.text')).not.toBeNull();
    expect(container.querySelector('.btn.textdanger')).toBeNull();
  });

  it('meldet Abbrechen über Escape', async () => {
    const { fixture } = await render(ConfirmDialogComponent, {
      inputs: { open: true, title: 'Fund löschen?' },
    });
    let calls = 0;
    fixture.componentInstance.cancelled.subscribe(() => (calls += 1));

    await userEvent.keyboard('{Escape}');

    expect(calls).toBe(1);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(ConfirmDialogComponent, {
      inputs: { open: true, title: 'Delete find?' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
