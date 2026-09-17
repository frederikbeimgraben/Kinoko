import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ObjectMenuComponent } from './object-menu.component';

describe('ObjectMenuComponent', () => {
  it('renders nothing without a target', async () => {
    const { container } = await render(ObjectMenuComponent, { inputs: { target: null } });

    expect(container.querySelector('[role="menu"]')).toBeNull();
  });

  it('renders the three actions at the target point', async () => {
    const { container } = await render(ObjectMenuComponent, {
      inputs: { target: { x: 120, y: 240 } },
    });

    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
    const menu = container.querySelector<HTMLElement>('.objectmenu');
    expect(menu?.style.left).toBe('120px');
    expect(menu?.style.top).toBe('240px');
    await noViolations(container);
  });

  it('emits edit, centre and delete for their rows', async () => {
    const { fixture } = await render(ObjectMenuComponent, {
      inputs: { target: { x: 0, y: 0 } },
    });
    const calls: string[] = [];
    fixture.componentInstance.edit.subscribe(() => calls.push('edit'));
    fixture.componentInstance.centre.subscribe(() => calls.push('centre'));
    fixture.componentInstance.delete.subscribe(() => calls.push('delete'));
    const items = screen.getAllByRole('menuitem');

    await userEvent.click(items[0]);
    await userEvent.click(items[1]);
    await userEvent.click(items[2]);

    expect(calls).toEqual(['edit', 'centre', 'delete']);
  });

  it('emits closed when the scrim is pressed', async () => {
    const { container, fixture } = await render(ObjectMenuComponent, {
      inputs: { target: { x: 0, y: 0 } },
    });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));
    const scrim = container.querySelector<HTMLElement>('.objectmenu__scrim');
    if (!scrim) throw new Error('Scrim fehlt im Baum.');

    await userEvent.click(scrim);

    expect(calls).toBe(1);
  });

  it('emits closed on Escape inside the menu', async () => {
    const { fixture } = await render(ObjectMenuComponent, {
      inputs: { target: { x: 0, y: 0 } },
    });
    let calls = 0;
    fixture.componentInstance.closed.subscribe(() => (calls += 1));

    await userEvent.keyboard('{Escape}');

    expect(calls).toBe(1);
  });

  it('focuses the first action once the menu opens', async () => {
    const { fixture } = await render(ObjectMenuComponent, { inputs: { target: null } });

    fixture.componentRef.setInput('target', { x: 10, y: 10 });
    fixture.detectChanges();

    expect(document.activeElement).toBe(screen.getAllByRole('menuitem')[0]);
  });

  it('moves focus between the actions with the arrow keys', async () => {
    await render(ObjectMenuComponent, { inputs: { target: { x: 0, y: 0 } } });
    const items = screen.getAllByRole('menuitem');
    items[0].focus();

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[1]);

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[2]);

    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(items[0]);

    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(items[2]);
  });

  it('dims the screen behind the menu by a quarter', async () => {
    const { container } = await render(ObjectMenuComponent, {
      inputs: { target: { x: 0, y: 0 } },
    });

    const scrim = container.querySelector<HTMLElement>('.objectmenu__scrim');
    expect(scrim).toHaveStyle({ background: 'rgb(0 0 0 / 25%)' });
  });

  it('draws every icon at seventeen pixels', async () => {
    const { container } = await render(ObjectMenuComponent, {
      inputs: { target: { x: 0, y: 0 } },
    });

    const icons = container.querySelectorAll<SVGSVGElement>('[role="menuitem"] svg');
    expect(icons).toHaveLength(3);
    for (const icon of icons) {
      expect(icon.getAttribute('width')).toBe('17');
      expect(icon.getAttribute('height')).toBe('17');
    }
  });

  it('marks every action as a tap target with a press state', async () => {
    await render(ObjectMenuComponent, { inputs: { target: { x: 0, y: 0 } } });

    for (const item of screen.getAllByRole('menuitem')) {
      expect(item).toHaveClass('tap');
      expect(item).toHaveAttribute('data-press', 'tint');
    }
  });

  it('renders without German text against an empty catalogue', async () => {
    const { container } = await render(ObjectMenuComponent, {
      inputs: { target: { x: 0, y: 0 } },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
