import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ChipGroupComponent, type Chip } from './chip-group.component';

const CHIPS: Chip[] = [
  { value: 'buche', label: 'Buche' },
  { value: 'eiche', label: 'Eiche' },
  { value: 'fichte', label: 'Fichte' },
];

describe('ChipGroupComponent', () => {
  it('zeigt den gewählten Chip als gedrückt', async () => {
    const { container } = await render(ChipGroupComponent, {
      inputs: { chips: CHIPS, value: ['buche'], label: 'Baumpartner' },
    });

    expect(screen.getByRole('button', { name: 'Buche' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Eiche' })).toHaveAttribute('aria-pressed', 'false');
    await noViolations(container);
  });

  it('ersetzt die Wahl bei Einfachwahl', async () => {
    const { fixture } = await render(ChipGroupComponent, {
      inputs: { chips: CHIPS, value: ['buche'], label: 'Baumpartner' },
    });
    const selected: (readonly string[])[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));

    await userEvent.click(screen.getByRole('button', { name: 'Eiche' }));

    expect(selected).toEqual([['eiche']]);
  });

  it('sammelt mehrere Werte bei Mehrfachwahl', async () => {
    const { fixture } = await render(ChipGroupComponent, {
      inputs: { chips: CHIPS, value: ['buche'], label: 'Baumpartner', multiple: true },
    });
    const selected: (readonly string[])[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));

    await userEvent.click(screen.getByRole('button', { name: 'Eiche' }));
    await userEvent.click(screen.getByRole('button', { name: 'Buche' }));

    expect(selected).toEqual([['buche', 'eiche'], ['eiche']]);
  });

  it('hängt bei addable einen gestrichelten Plus-Chip an', async () => {
    const { container, fixture } = await render(ChipGroupComponent, {
      inputs: { chips: CHIPS, value: [], label: 'Baumpartner', addable: true },
    });
    let calls = 0;
    fixture.componentInstance.added.subscribe(() => (calls += 1));

    const addChip = container.querySelector('.chip--add');
    expect(addChip).not.toBeNull();
    await userEvent.click(addChip as HTMLElement);

    expect(calls).toBe(1);
    await noViolations(container);
  });

  it('lässt den Plus-Chip weg, wenn addable fehlt', async () => {
    const { container } = await render(ChipGroupComponent, {
      inputs: { chips: CHIPS, value: [], label: 'Baumpartner' },
    });

    expect(container.querySelector('.chip--add')).toBeNull();
  });

  it('trägt die Tippfläche an jedem Chip', async () => {
    const { container } = await render(ChipGroupComponent, {
      inputs: { chips: CHIPS, value: [], label: 'Baumpartner' },
    });

    const chip = container.querySelector('.chip');
    expect(chip).toHaveClass('tap');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const chips: Chip[] = [{ value: 'a', label: 'a' }];
    const { container } = await render(ChipGroupComponent, {
      inputs: { chips, value: [], label: 'group', addable: true },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
