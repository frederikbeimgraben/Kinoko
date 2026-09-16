import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { SwitchComponent } from './switch.component';

async function build(checked = false): Promise<{ container: Element }> {
  const { container } = await render(SwitchComponent, {
    inputs: { checked, label: 'Vorhersage' },
  });
  return { container };
}

describe('SwitchComponent', () => {
  it('nennt seinen Zustand als Schalter', async () => {
    const { container } = await build(true);

    const found = screen.getByRole('switch', { name: 'Vorhersage' });
    expect(found).toBeChecked();
    await noViolations(container);
  });

  it('meldet den Wechsel beim Tippen', async () => {
    const { fixture } = await render(SwitchComponent, {
      inputs: { checked: false, label: 'Vorhersage' },
    });
    const seen: boolean[] = [];
    fixture.componentInstance.checkedChange.subscribe((value: boolean) => seen.push(value));

    await userEvent.click(screen.getByRole('switch'));

    expect(seen).toEqual([true]);
  });

  it('wechselt auch über die Tastatur', async () => {
    const { fixture } = await render(SwitchComponent, {
      inputs: { checked: true, label: 'Vorhersage' },
    });
    const seen: boolean[] = [];
    fixture.componentInstance.checkedChange.subscribe((value: boolean) => seen.push(value));

    screen.getByRole('switch').focus();
    await userEvent.keyboard(' ');

    expect(seen).toEqual([false]);
  });

  it('meldet keinen Wechsel, solange er gesperrt ist', async () => {
    const { fixture } = await render(SwitchComponent, {
      inputs: { checked: true, label: 'Titelbild', disabled: true },
    });
    const seen: boolean[] = [];
    fixture.componentInstance.checkedChange.subscribe((value: boolean) => seen.push(value));

    await userEvent.click(screen.getByRole('switch'));

    expect(seen).toEqual([]);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-disabled', 'true');
  });
});
