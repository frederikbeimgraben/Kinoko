import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { AddRowComponent } from './add-row.component';

describe('AddRowComponent', () => {
  it('nennt die Sache und die Handlung', async () => {
    const { container } = await render(AddRowComponent, {
      inputs: { label: 'Faktor', action: 'Faktor hinzufügen' },
    });

    expect(screen.getByRole('button', { name: 'Faktor hinzufügen' })).toHaveTextContent('Faktor');
    await noViolations(container);
  });

  it('meldet den Druck', async () => {
    const { fixture } = await render(AddRowComponent, {
      inputs: { label: 'Faktor', action: 'Faktor hinzufügen' },
    });
    let calls = 0;
    fixture.componentInstance.pressed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button'));

    expect(calls).toBe(1);
  });
});
