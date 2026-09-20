import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { EntryRowComponent, type EntryRowEntry } from './entry-row.component';

const PFIFFERLING: EntryRowEntry = {
  title: 'Pfifferling',
  meta: 'Heute · 2 Stück · Frederik',
  note: 'unter Fichten am Hang',
  colour: '#b9832a',
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

  it('zeigt eine Vorschau mit der Grundfarbe des Eintrags', async () => {
    const { container } = await render(EntryRowComponent, { inputs: { entry: PFIFFERLING } });

    const thumb = container.querySelector('app-private-image');
    expect(thumb).not.toBeNull();
  });

  it('zeigt einen Upload-Pfeil statt des Pfeilkopfs, solange die Übertragung aussteht', async () => {
    const { container } = await render(EntryRowComponent, {
      inputs: { entry: PFIFFERLING, pending: true },
    });

    expect(container.querySelector('.item__pending')).not.toBeNull();
    expect(container.querySelector('.item__chevron')).toBeNull();
    expect(container.querySelector('[role="img"]')).toHaveAttribute('aria-label', 'Übertragung ausstehend');
  });

  it('zeigt den Pfeilkopf, solange nichts aussteht', async () => {
    const { container } = await render(EntryRowComponent, { inputs: { entry: PFIFFERLING } });

    expect(container.querySelector('.item__chevron')).not.toBeNull();
    expect(container.querySelector('.item__pending')).toBeNull();
  });

  it('trägt den gewählten Zustand', async () => {
    const { container } = await render(EntryRowComponent, {
      inputs: { entry: PFIFFERLING, selected: true },
    });

    expect(container.querySelector('.item--selected')).not.toBeNull();
  });

  it('meldet die gewählte Zeile', async () => {
    const { fixture } = await render(EntryRowComponent, { inputs: { entry: PFIFFERLING } });
    let calls = 0;
    fixture.componentInstance.chosen.subscribe(() => (calls += 1));
    const button = screen.getByRole('button', { name: /Pfifferling/ });

    await userEvent.click(button);
    button.focus();
    await userEvent.keyboard('{Enter}');

    expect(calls).toBe(2);
    expect(button).toHaveClass('tap');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(EntryRowComponent, {
      inputs: { entry: { title: 'Row', meta: 'Meta', note: 'Note' }, pending: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
