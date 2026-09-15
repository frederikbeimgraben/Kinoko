import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { AddActionsComponent, type AddAction } from './add-actions.component';

interface Setup {
  container: Element;
  chosen: AddAction[];
}

async function build(): Promise<Setup> {
  const { container, fixture } = await render(AddActionsComponent, {});
  const chosen: AddAction[] = [];
  fixture.componentInstance.chosen.subscribe((action) => chosen.push(action));
  return { container, chosen };
}

describe('AddActionsComponent', () => {
  it('stellt die drei Wege des Eintragens als Zeilen auf', async () => {
    const { container } = await build();

    expect(screen.getByRole('button', { name: 'Fund melden' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Marker setzen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zone zeichnen' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet den gewählten Weg', async () => {
    const { chosen } = await build();

    await userEvent.click(screen.getByRole('button', { name: 'Marker setzen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Zone zeichnen' }));

    expect(chosen).toEqual(['marker', 'zone']);
  });

  it('trägt den Druckzustand an jeder Zeile', async () => {
    const { container } = await build();

    for (const row of container.querySelectorAll('.addactions__row')) {
      expect(row).toHaveClass('tap');
      expect(row).toHaveAttribute('data-press', 'tint');
    }
  });
});
