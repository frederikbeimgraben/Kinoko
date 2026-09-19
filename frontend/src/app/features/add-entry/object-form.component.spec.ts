import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { OBJECT_COLOURS } from '../../ui/colour-swatches/colour-swatches.component';
import { ObjectFormComponent, type ObjectValues } from './object-form.component';

const FIXED = { heading: 'Zone speichern', nameMissingText: 'Gib der Zone einen Namen.' };

interface Extra {
  start?: ObjectValues;
  location?: readonly [number, number];
  kind?: 'marker' | 'zone';
  editing?: boolean;
}

interface Setup {
  container: Element;
  saved: ObjectValues[];
  reported: ObjectValues[];
  cancels: number;
  toasts: ToastSpy;
}

async function build(extra: Extra = {}): Promise<Setup> {
  const { container, fixture } = await render(ObjectFormComponent, {
    inputs: { ...FIXED, ...extra },
  });
  const saved: ObjectValues[] = [];
  const reported: ObjectValues[] = [];
  let cancels = 0;
  fixture.componentInstance.submitted.subscribe((values) => saved.push(values));
  fixture.componentInstance.valuesChange.subscribe((values) => reported.push(values));
  fixture.componentInstance.cancelled.subscribe(() => (cancels += 1));
  return {
    container,
    saved,
    reported,
    toasts: toastSpy(),
    get cancels() {
      return cancels;
    },
  };
}

/** Die Beschriftungen der Felder in der Reihenfolge des Formulars. */
function labels(container: Element): string[] {
  return [...container.querySelectorAll('.field__label, .form__label')].map((node) =>
    node.textContent.trim(),
  );
}

describe('ObjektFormularComponent', () => {
  it('trägt Überschrift und Ort und gibt Name, Farbe, Sichtbarkeit und Notiz ab', async () => {
    const setup = await build({ location: [9.0511, 48.5203] });

    expect(screen.getByRole('heading', { name: 'Zone speichern' })).toBeInTheDocument();
    expect(screen.getByText('48,5203 · 9,0511')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Name'), 'Schönbuch Nord');
    await userEvent.click(screen.getByRole('radio', { name: 'Blau' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));
    await userEvent.type(screen.getByLabelText('Notiz'), 'Nordhang');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.saved).toEqual([
      { name: 'Schönbuch Nord', colour: 'blue', note: 'Nordhang', visibility: 'shared' },
    ]);
    await noViolations(setup.container);
  });

  it('gibt ohne Namen nichts her und sagt es', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.saved).toHaveLength(0);
    expect(setup.toasts.failure).toEqual(['Gib der Zone einen Namen.']);
  });

  it('füllt sich aus einem vorhandenen Objekt und lässt es ändern', async () => {
    const start: ObjectValues = {
      name: 'Schönbuch Nord',
      colour: 'red',
      note: 'Alte Fichten',
      visibility: 'shared',
      groupId: null,
    };
    const setup = await build({ start, editing: true });

    expect(screen.getByLabelText('Name')).toHaveValue('Schönbuch Nord');
    expect(screen.getByRole('radio', { name: 'Rot' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'Privat' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.saved[0].visibility).toBe('private');
  });

  it('stellt bei der Zone die Notiz hinter die Sichtbarkeit', async () => {
    const setup = await build({ kind: 'zone' });

    expect(labels(setup.container)).toEqual(['Name', 'Farbe', 'Sichtbarkeit', 'Notiz']);
  });

  it('stellt beim Marker die Notiz vor die Sichtbarkeit', async () => {
    const setup = await build({ kind: 'marker' });

    expect(labels(setup.container)).toEqual(['Name', 'Farbe', 'Notiz', 'Sichtbarkeit']);
  });

  it('meldet jede Änderung, damit die Karte der Farbe folgen kann', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('radio', { name: 'Gold' }));

    expect(setup.reported.at(-1)?.colour).toBe('gold');
    expect(OBJECT_COLOURS).toContain('#876010');
  });

  it('meldet den Abbruch', async () => {
    const setup = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(setup.cancels).toBe(1);
  });
});
