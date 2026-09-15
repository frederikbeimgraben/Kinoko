import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { OBJECT_COLOURS } from '../../ui/colour-swatches/colour-swatches.component';
import { ObjectFormComponent, type ObjectValues } from './object-form.component';

const LABELS = {
  nameLabel: 'Name',
  namePlaceholder: 'Name der Zone',
  nameMissingText: 'Gib der Zone einen Namen.',
};

describe('ObjektFormularComponent', () => {
  it('sammelt Name, Farbe, Sichtbarkeit und Notiz', async () => {
    const { fixture, container } = await render(ObjectFormComponent, { inputs: LABELS });

    await userEvent.type(screen.getByLabelText('Name'), 'Schönbuch Nord');
    await userEvent.click(screen.getByRole('radio', { name: 'Blau' }));
    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));
    await userEvent.type(screen.getByLabelText('Notiz'), 'Nordhang');

    expect(fixture.componentInstance.values()).toEqual({
      name: 'Schönbuch Nord',
      colour: 'blue',
      note: 'Nordhang',
      visibility: 'shared',
    });
    await noViolations(container);
  });

  it('gibt ohne Namen nichts her', async () => {
    const { fixture } = await render(ObjectFormComponent, { inputs: LABELS });

    expect(fixture.componentInstance.values()).toBeNull();
  });

  it('füllt sich aus einem vorhandenen Objekt und lässt es ändern', async () => {
    const start: ObjectValues = {
      name: 'Schönbuch Nord',
      colour: 'red',
      note: 'Alte Fichten',
      visibility: 'shared',
    };
    const { fixture } = await render(ObjectFormComponent, {
      inputs: { ...LABELS, start },
    });

    expect(screen.getByLabelText('Name')).toHaveValue('Schönbuch Nord');
    expect(screen.getByRole('radio', { name: 'Rot' })).toHaveAttribute('aria-checked', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'Privat' }));

    expect(fixture.componentInstance.values()?.visibility).toBe('private');
  });

  it('lässt das Namensfeld weg, wo der Name schon als Überschrift steht', async () => {
    const start: ObjectValues = { name: 'Zone', colour: 'green', note: null, visibility: 'private' };
    const { fixture } = await render(ObjectFormComponent, {
      inputs: { ...LABELS, withoutName: true, start },
    });

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument();
    expect(fixture.componentInstance.values()?.name).toBe('Zone');
  });

  it('meldet jede Änderung, damit die Karte der Farbe folgen kann', async () => {
    const { fixture } = await render(ObjectFormComponent, { inputs: LABELS });
    const reported: ObjectValues[] = [];
    fixture.componentInstance.valuesChange.subscribe((values) => reported.push(values));

    await userEvent.click(screen.getByRole('radio', { name: 'Gold' }));

    expect(reported.at(-1)?.colour).toBe('gold');
    expect(OBJECT_COLOURS).toContain('#876010');
  });
});
