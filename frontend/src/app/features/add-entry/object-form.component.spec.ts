import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { toastSpy, type ToastSpy } from '../../testing/toast-spy';
import { OBJECT_COLOURS } from '../../ui/colour-swatches/colour-swatches.component';
import { ObjectFormComponent, type ObjectValues } from './object-form.component';

const FIXED = { nameMissingText: 'Gib der Zone einen Namen.' };

interface Extra {
  start?: ObjectValues;
  kind?: 'marker' | 'zone';
  editing?: boolean;
}

interface Setup {
  container: Element;
  saved: ObjectValues[];
  reported: ObjectValues[];
  toasts: ToastSpy;
}

async function build(extra: Extra = {}): Promise<Setup> {
  const { container, fixture } = await render(ObjectFormComponent, {
    inputs: { ...FIXED, ...extra },
  });
  const saved: ObjectValues[] = [];
  const reported: ObjectValues[] = [];
  fixture.componentInstance.submitted.subscribe((values) => saved.push(values));
  fixture.componentInstance.valuesChange.subscribe((values) => reported.push(values));
  return { container, saved, reported, toasts: toastSpy() };
}

/** Die Beschriftungen der Felder in der Reihenfolge des Formulars. */
function labels(container: Element): string[] {
  const chosen = '.field__label, .form__label, .choice__label';
  return [...container.querySelectorAll(chosen)].map((node) => node.textContent.trim());
}

describe('ObjektFormularComponent', () => {
  it('gibt Name, Farbe, Sichtbarkeit und Notiz ab', async () => {
    const setup = await build();

    await userEvent.type(screen.getByLabelText('Name'), 'Schönbuch Nord');
    await userEvent.click(screen.getByRole('radio', { name: 'Blau' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));
    await userEvent.type(screen.getByLabelText('Notiz'), 'Nordhang');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));

    expect(setup.saved).toEqual([
      {
        name: 'Schönbuch Nord',
        colour: 'blue',
        note: 'Nordhang',
        visibility: 'shared',
        groupId: null,
      },
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

  it('trägt keinen eigenen Kopf: das Blatt stellt Titel und Ort', async () => {
    const setup = await build();

    expect(setup.container.querySelector('.form__head')).toBeNull();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });

  it('trägt keinen Abbrechen-Knopf: das X des Blatts bricht ab', async () => {
    await build();

    expect(screen.queryByRole('button', { name: 'Abbrechen' })).not.toBeInTheDocument();
  });
});
