import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { StepBarComponent, type StepAction } from './step-bar.component';

const ACTIONS: readonly StepAction[] = [
  { label: 'Eckpunkt setzen', icon: 'plus', variant: 'primary', run: () => undefined },
  { label: 'Punkt entfernen', icon: 'undo', variant: 'secondary', run: () => undefined },
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

  it('stellt die runden Knöpfe vor dem beschrifteten Fab, unabhängig von der Reihenfolge der Eingabe', async () => {
    const { container } = await render(StepBarComponent, {
      inputs: { label: 'Zone zeichnen', actions: ACTIONS },
    });

    const order = [...container.querySelectorAll('app-icon-button, app-floating-button')].map((el) =>
      el.tagName.toLowerCase(),
    );
    expect(order).toEqual(['app-icon-button', 'app-icon-button', 'app-icon-button', 'app-floating-button']);
  });

  it('trägt nur ein Zeichen an den runden Knöpfen, ein Wort am Fab', async () => {
    await render(StepBarComponent, { inputs: { label: 'Zone zeichnen', actions: ACTIONS } });

    expect(screen.getByRole('button', { name: 'Punkt entfernen' })).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'Abbrechen' })).toHaveTextContent('');
    expect(screen.getByRole('button', { name: 'Eckpunkt setzen' })).toHaveTextContent('Eckpunkt setzen');
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

  it('lässt die Marke aus, solange keine da ist', async () => {
    const { container } = await render(StepBarComponent, {
      inputs: { label: 'Fundort festlegen', actions: ACTIONS.slice(2) },
    });

    expect(container.querySelector('.stepbar__note')).toBeNull();
  });
});
