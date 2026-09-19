import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { OptionSheetComponent, type OptionSheetOption } from './option-sheet.component';

const OPTIONS: readonly OptionSheetOption[] = [
  { id: 'rain', title: 'Niederschlag der letzten 4 Wochen', icon: 'cloud', value: 'mm' },
  { id: 'temp', title: 'Mitteltemperatur der Woche', icon: 'thermometer', value: '°C' },
];

describe('OptionSheetComponent', () => {
  it('bleibt ohne Inhalt, solange das Blatt zu ist', async () => {
    await render(OptionSheetComponent, {
      inputs: { open: false, title: 'Faktor wählen', options: OPTIONS },
    });

    expect(screen.queryByText('Faktor wählen')).not.toBeInTheDocument();
  });

  it('nennt jede Zeile mit Titel und Wert', async () => {
    const { container } = await render(OptionSheetComponent, {
      inputs: { open: true, title: 'Faktor wählen', options: OPTIONS },
    });

    expect(screen.getByRole('heading', { name: 'Faktor wählen' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Mitteltemperatur der Woche/ })).toHaveTextContent('°C');
    await noViolations(container);
  });

  it('meldet die gewählte Zeile über ihre Kennung', async () => {
    const { fixture } = await render(OptionSheetComponent, {
      inputs: { open: true, title: 'Faktor wählen', options: OPTIONS },
    });
    const picks: string[] = [];
    fixture.componentInstance.chosen.subscribe((id) => picks.push(id));

    await userEvent.click(screen.getByRole('button', { name: /Mitteltemperatur der Woche/ }));

    expect(picks).toEqual(['temp']);
  });

  it('trägt bei der gewählten Zeile einen Haken statt eines Pfeils', async () => {
    const { container } = await render(OptionSheetComponent, {
      inputs: { open: true, title: 'Faktor wählen', options: OPTIONS, selected: 'temp' },
    });

    const rows = [...container.querySelectorAll('app-list-row')];
    expect(rows[0]?.querySelector('.row__chevron')).not.toBeNull();
    expect(rows[1]?.querySelector('.row__chevron')).toBeNull();
    expect(screen.getByRole('button', { name: /Mitteltemperatur der Woche/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('meldet das Schließen über das X des Blatts', async () => {
    const { container, fixture } = await render(OptionSheetComponent, {
      inputs: { open: true, title: 'Faktor wählen', options: OPTIONS },
    });
    let closes = 0;
    fixture.componentInstance.closed.subscribe(() => (closes += 1));
    expect(container.querySelector('.overlay-body__close')).toBeNull();
    const close = container.querySelector<HTMLElement>('.sheet__close');
    if (close === null) throw new Error('Der Knopf zum Schließen steht nicht im Baum.');

    await userEvent.click(close);

    expect(closes).toBe(1);
  });

  it('bietet bei Mehrfachwahl Prüfzeilen statt Pfeilzeilen', async () => {
    const { container } = await render(OptionSheetComponent, {
      inputs: { open: true, title: 'Teile wählen', options: OPTIONS, multiple: true, confirmLabel: 'Hinzufügen' },
    });

    expect(screen.getByRole('checkbox', { name: 'Mitteltemperatur der Woche' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mitteltemperatur der Woche/ })).not.toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet bei Mehrfachwahl die gewählte Menge über den Fuß und leert sie danach', async () => {
    const { fixture } = await render(OptionSheetComponent, {
      inputs: { open: true, title: 'Teile wählen', options: OPTIONS, multiple: true, confirmLabel: 'Hinzufügen' },
    });
    const picks: (readonly string[])[] = [];
    fixture.componentInstance.confirmed.subscribe((ids) => picks.push(ids));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Niederschlag der letzten 4 Wochen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Hinzufügen' }));

    expect(picks).toEqual([['rain']]);
    expect(screen.getByRole('checkbox', { name: 'Niederschlag der letzten 4 Wochen' })).not.toBeChecked();
  });

  it('leert bei Mehrfachwahl die Wahl beim Schließen', async () => {
    const { fixture } = await render(OptionSheetComponent, {
      inputs: { open: true, title: 'Teile wählen', options: OPTIONS, multiple: true, confirmLabel: 'Hinzufügen' },
    });
    let closes = 0;
    fixture.componentInstance.closed.subscribe(() => (closes += 1));

    await userEvent.click(screen.getByRole('checkbox', { name: 'Niederschlag der letzten 4 Wochen' }));
    const sheet = screen.getByRole('dialog');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Schließen' }));

    expect(closes).toBe(1);
    expect(screen.getByRole('checkbox', { name: 'Niederschlag der letzten 4 Wochen' })).not.toBeChecked();
  });
});
