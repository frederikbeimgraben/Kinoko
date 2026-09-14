import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { EntryRowComponent, type EntryRowEntry } from './entry-row.component';

const PFIFFERLING: EntryRowEntry = {
  title: 'Pfifferling',
  meta: 'Heute · 2 Stück · Frederik',
  note: 'unter Fichten am Hang',
};

describe('EntryRowComponent', () => {
  it('zeigt Titel und Meta ohne Notiz', async () => {
    const { container } = await render(EntryRowComponent, {
      inputs: { entry: { title: 'Steinpilz', meta: '6. Sept · 3 Stück · Frederik' } },
    });

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('6. Sept · 3 Stück · Frederik')).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt die Notiz, wenn der Eintrag eine trägt', async () => {
    await render(EntryRowComponent, { inputs: { entry: PFIFFERLING } });

    expect(screen.getByText('unter Fichten am Hang')).toBeInTheDocument();
  });

  it('zeigt den Zustand ausstehend als Plakette ohne Farbpunkt', async () => {
    const { container } = await render(EntryRowComponent, {
      inputs: { entry: PFIFFERLING, pending: true },
    });

    expect(screen.getByText('Übertragung ausstehend')).toBeInTheDocument();
    expect(container.querySelector('[style*="border-radius: 50%"]')).toBeNull();
  });

  it('lässt die Plakette weg, solange nichts aussteht', async () => {
    await render(EntryRowComponent, { inputs: { entry: PFIFFERLING } });

    expect(screen.queryByText('Übertragung ausstehend')).not.toBeInTheDocument();
  });

  it('meldet die gewählte Zeile und trägt den Druckzustand', async () => {
    const { fixture } = await render(EntryRowComponent, { inputs: { entry: PFIFFERLING } });
    let calls = 0;
    fixture.componentInstance.chosen.subscribe(() => (calls += 1));
    const button = screen.getByRole('button', { name: /Pfifferling/ });

    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard('{Enter}');

    expect(calls).toBe(2);
    expect(button).toHaveClass('tap');
    expect(button).toHaveAttribute('data-press', 'tint');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(EntryRowComponent, {
      inputs: { entry: { title: 'Row', meta: 'Meta', note: 'Note' }, pending: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
