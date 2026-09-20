import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { EntryListComponent, type EntryListRow } from './entry-list.component';

const ROWS: EntryListRow[] = [
  { key: 'a', day: 'Heute', entry: { title: 'Pfifferling', meta: '2 Stück' }, pending: true },
  { key: 'b', day: 'September', entry: { title: 'Steinpilz', meta: '3 Stück' } },
  { key: 'c', day: 'September', entry: { title: 'Parasol', meta: '5 Stück' } },
];

describe('EntryListComponent', () => {
  it('zeigt jede Zeile', async () => {
    const { container } = await render(EntryListComponent, { inputs: { rows: ROWS } });

    expect(screen.getByText('Pfifferling')).toBeInTheDocument();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Parasol')).toBeInTheDocument();
    await noViolations(container);
  });

  it('setzt eine Kopfzeile vor die erste Zeile eines neuen Tages', async () => {
    const { container } = await render(EntryListComponent, { inputs: { rows: ROWS } });

    const heads = container.querySelectorAll('.lbl');
    expect(heads).toHaveLength(2);
    expect(heads[0]).toHaveTextContent('Heute');
    expect(heads[1]).toHaveTextContent('September');
  });

  it('lässt die Kopfzeile ohne Tagesangabe weg', async () => {
    const { container } = await render(EntryListComponent, {
      inputs: { rows: [{ key: 'a', entry: { title: 'Pfifferling', meta: '2 Stück' } }] },
    });

    expect(container.querySelector('.lbl')).toBeNull();
  });

  it('meldet die gewählte Zeile mit ihrem Ursprung', async () => {
    const { fixture } = await render(EntryListComponent, { inputs: { rows: ROWS } });
    const chosen: EntryListRow[] = [];
    fixture.componentInstance.chosen.subscribe((row) => chosen.push(row));

    await userEvent.click(screen.getByRole('button', { name: /Steinpilz/ }));

    expect(chosen).toEqual([ROWS[1]]);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(EntryListComponent, {
      inputs: {
        rows: [{ key: 'a', day: 'Today', entry: { title: 'Chanterelle', meta: '2 pieces' } }],
      },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
