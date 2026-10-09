import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import type { Location } from './add-entry.store';
import { ObjectFormComponent, type ObjectValues } from './object-form.component';

const FIXED = { nameMissingText: 'Gib der Zone einen Namen.' };

interface Extra {
  start?: ObjectValues;
  kind?: 'marker' | 'zone';
  location?: Location | null;
  area?: number | null;
}

interface Setup {
  container: Element;
  saved: ObjectValues[];
  located: ObjectValues[];
  outlined: ObjectValues[];
  toasts: ToastSpy;
}

async function build(extra: Extra = {}): Promise<Setup> {
  const { container, fixture } = await render(ObjectFormComponent, {
    inputs: { ...FIXED, ...extra },
  });
  const saved: ObjectValues[] = [];
  const located: ObjectValues[] = [];
  const outlined: ObjectValues[] = [];
  fixture.componentInstance.submitted.subscribe((values) => saved.push(values));
  fixture.componentInstance.locationClick.subscribe((values) => located.push(values));
  fixture.componentInstance.outlineClick.subscribe((values) => outlined.push(values));
  return { container, saved, located, outlined, toasts: toastSpy() };
}

/** The field and section labels in form order. */
function labels(container: Element): string[] {
  const chosen = '.field__label, .lbl, app-list-row .row__title';
  return [...container.querySelectorAll(chosen)].map((node) => node.textContent.trim());
}

describe('ObjectFormComponent', () => {
  it('gibt Name, Notiz und Farbe ab und behält die Sichtbarkeit', async () => {
    const setup = await build();

    await userEvent.type(screen.getByLabelText('Name'), 'Schönbuch Nord');
    await userEvent.type(screen.getByLabelText('Notiz'), 'Nordhang');
    await userEvent.click(screen.getByRole('button', { name: 'Orange' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.saved).toEqual([
      { name: 'Schönbuch Nord', colour: 'orange', note: 'Nordhang', visibility: 'private', groupId: null },
    ]);
    expect(screen.queryByText('Sichtbarkeit')).not.toBeInTheDocument();
    await noViolations(setup.container);
  });

  it('bietet die sechs Farben der Boards mit Namen und Punkt', async () => {
    const setup = await build();

    const chips = [...setup.container.querySelectorAll('app-filter-chip')].map((chip) =>
      chip.textContent.trim(),
    );
    expect(chips).toEqual(['Grün', 'Gelb', 'Orange', 'Rot', 'Violett', 'Grau']);
    expect(screen.getByRole('button', { name: 'Grün' })).toHaveAttribute('aria-pressed', 'true');
    expect(setup.container.querySelectorAll('.chip__dot')).toHaveLength(6);
  });

  it('gibt ohne Namen nichts her und sagt es', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.saved).toHaveLength(0);
    expect(setup.toasts.failure).toEqual(['Gib der Zone einen Namen.']);
  });

  it('füllt sich aus einem vorhandenen Objekt und behält seine Freigabe', async () => {
    const start: ObjectValues = {
      name: 'Schönbuch Nord',
      colour: 'red',
      note: 'Alte Fichten',
      visibility: 'shared',
      groupId: 'gruppe-eins',
    };
    const setup = await build({ start, kind: 'zone' });

    expect(screen.getByLabelText('Name')).toHaveValue('Schönbuch Nord');
    expect(screen.getByRole('button', { name: 'Rot' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.saved[0]).toEqual(start);
  });

  it('stellt beim Marker Ort, Name, Notiz und Farbe in die Reihenfolge der Boards', async () => {
    const setup = await build({ kind: 'marker', location: [9.0511, 48.5203] });

    expect(labels(setup.container)).toEqual(['Ort', 'Name', 'Notiz', 'Farbe']);
    expect(screen.getByRole('button', { name: /Ort/ })).toHaveTextContent('48,5203 · 9,0511');
    expect(screen.queryByRole('button', { name: 'Umriss ändern' })).not.toBeInTheDocument();
  });

  it('stellt bei der Zone Name, Notiz, Farbe und Fläche in die Reihenfolge der Boards', async () => {
    const setup = await build({ kind: 'zone', area: 42 });

    expect(labels(setup.container)).toEqual(['Name', 'Notiz', 'Farbe', 'Fläche']);
    expect(setup.container.querySelector('.row__value')).toHaveTextContent('42ha');
  });

  it('gibt die Werte an die Zeile Ort und an „Umriss ändern“ weiter', async () => {
    const marker = await build({ kind: 'marker', location: [9, 48] });
    await userEvent.type(screen.getByLabelText('Name'), 'Hang');
    await userEvent.click(screen.getByRole('button', { name: /Ort/ }));
    expect(marker.located[0].name).toBe('Hang');
  });

  it('gibt bei der Zone die Werte an „Umriss ändern“', async () => {
    const zone = await build({ kind: 'zone', area: 3 });
    await userEvent.type(screen.getByLabelText('Name'), 'Mulde');
    await userEvent.click(screen.getByRole('button', { name: 'Umriss ändern' }));
    expect(zone.outlined[0].name).toBe('Mulde');
  });

  it('trägt keinen Abbrechen-Knopf: das X des Blatts bricht ab', async () => {
    await build();

    expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument();
  });
});
