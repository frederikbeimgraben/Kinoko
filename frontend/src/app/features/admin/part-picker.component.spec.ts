import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { BodyPart, SpeciesEntry } from '../../core/api/models';
import { noViolations } from '../../testing/axe';
import { PartPickerComponent } from './part-picker.component';

const SPECIES = {
  measurements: [{ part: 'cap', measurements: [] }],
  colours: [{ part: 'tubes', mode: 'single', colours: [] }],
  colourChanges: [],
} as unknown as SpeciesEntry;

describe('PartPickerComponent', () => {
  it('bietet die Teile, die die Art noch nicht führt', async () => {
    const { container } = await render(PartPickerComponent, {
      inputs: { open: true, species: SPECIES, held: [] },
    });

    expect(await screen.findByRole('checkbox', { name: 'Fruchtkörper' })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: 'Hut' })).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet die gewählten Teile und leert die Wahl', async () => {
    const { fixture } = await render(PartPickerComponent, {
      inputs: { open: true, species: SPECIES, held: [] },
    });
    const picks: readonly BodyPart[][] = [];
    const seen: BodyPart[][] = picks as BodyPart[][];
    fixture.componentInstance.chosen.subscribe((parts) => seen.push([...parts]));

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Stiel' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Fleisch' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Fleisch' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(seen).toEqual([['stem']]);
    expect(screen.getByRole('checkbox', { name: 'Stiel' })).not.toBeChecked();
  });

  it('meldet das Schließen und lässt die Wahl fallen', async () => {
    const { fixture } = await render(PartPickerComponent, {
      inputs: { open: true, species: SPECIES, held: ['stem'] },
    });
    let closes = 0;
    fixture.componentInstance.closed.subscribe(() => (closes += 1));

    await userEvent.click(await screen.findByRole('checkbox', { name: 'Fleisch' }));
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(closes).toBe(1);
    expect(screen.queryByRole('checkbox', { name: 'Stiel' })).not.toBeInTheDocument();
  });
});
