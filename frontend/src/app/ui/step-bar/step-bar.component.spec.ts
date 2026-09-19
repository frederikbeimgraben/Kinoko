import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { StepBarComponent, type StepAction } from './step-bar.component';

const ACTIONS: readonly StepAction[] = [
  { label: 'Eckpunkt setzen', icon: 'plus', variant: 'primary', run: () => undefined },
  { label: 'Punkt entfernen', icon: 'back', variant: 'secondary', run: () => undefined },
  { label: 'Abschließen', icon: 'check', variant: 'secondary', run: () => undefined },
  { label: 'Abbrechen', icon: 'close', variant: 'secondary', run: () => undefined },
];

describe('StepBarComponent', () => {
  it('nennt die Marke und jede Aktion', async () => {
    const { container } = await render(StepBarComponent, {
      inputs: { label: 'Zone zeichnen', note: '4 Eckpunkte · 42 ha', actions: ACTIONS },
    });

    expect(screen.getByRole('group', { name: 'Zone zeichnen' })).toBeInTheDocument();
    expect(screen.getByText('4 Eckpunkte · 42 ha')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(4);
    await noViolations(container);
  });

  it('trägt nur Zeichen, keinen Text im Knopf', async () => {
    await render(StepBarComponent, { inputs: { label: 'Zone zeichnen', actions: ACTIONS } });

    for (const button of screen.getAllByRole('button')) expect(button).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'Abschließen' })).toBeInTheDocument();
  });

  it('meldet die gewählte Aktion', async () => {
    const { fixture } = await render(StepBarComponent, {
      inputs: { label: 'Zone zeichnen', actions: ACTIONS },
    });
    const chosen: string[] = [];
    fixture.componentInstance.chosen.subscribe((action) => chosen.push(action.label));

    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));

    expect(chosen).toEqual(['Abbrechen']);
  });

  it('trägt die Rolle jeder Aktion', async () => {
    const { container } = await render(StepBarComponent, {
      inputs: { label: 'Zone zeichnen', actions: ACTIONS },
    });

    expect(container.querySelectorAll('.stepbar__action--primary')).toHaveLength(1);
  });

  it('lässt die Marke aus, solange keine da ist', async () => {
    const { container } = await render(StepBarComponent, {
      inputs: { label: 'Fundort festlegen', actions: ACTIONS.slice(2) },
    });

    expect(container.querySelector('.stepbar__note')).toBeNull();
  });
});
