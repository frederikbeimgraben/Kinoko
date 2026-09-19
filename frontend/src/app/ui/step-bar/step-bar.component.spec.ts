import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { StepBarComponent, type StepAction } from './step-bar.component';

const ACTIONS: readonly StepAction[] = [
  { label: 'Abbrechen', variant: 'ghost', run: () => undefined },
  { label: 'Letzten Punkt entfernen', variant: 'secondary', run: () => undefined },
  { label: 'Abschließen', wideLabel: 'Zone abschließen', variant: 'primary', run: () => undefined },
];

describe('StepBarComponent', () => {
  it('nennt Titel, Werte und jede Aktion', async () => {
    const { container } = await render(StepBarComponent, {
      inputs: { title: 'Zone zeichnen', note: '4 Eckpunkte · 42 ha', actions: ACTIONS },
    });

    expect(screen.getByRole('group', { name: 'Zone zeichnen' })).toBeInTheDocument();
    expect(screen.getByText('4 Eckpunkte · 42 ha')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    await noViolations(container);
  });

  it('nimmt in der Leiste das lange Wort', async () => {
    await render(StepBarComponent, {
      inputs: { title: 'Zone zeichnen', actions: ACTIONS },
    });

    expect(screen.getByRole('button', { name: 'Zone abschließen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abschließen' })).not.toBeInTheDocument();
  });

  it('meldet die gewählte Aktion', async () => {
    const { fixture } = await render(StepBarComponent, {
      inputs: { title: 'Zone zeichnen', actions: ACTIONS },
    });
    const chosen: string[] = [];
    fixture.componentInstance.chosen.subscribe((action) => chosen.push(action.label));

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(chosen).toEqual(['Abbrechen']);
  });

  it('trägt die Rolle jeder Aktion', async () => {
    const { container } = await render(StepBarComponent, {
      inputs: { title: 'Zone zeichnen', actions: ACTIONS },
    });

    expect(container.querySelectorAll('.stepbar__action--primary')).toHaveLength(1);
    expect(container.querySelectorAll('.stepbar__action--secondary')).toHaveLength(1);
  });
});
