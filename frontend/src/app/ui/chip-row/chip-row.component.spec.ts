import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { ChipRowComponent, type ChipRowItem } from './chip-row.component';

const CHIPS: readonly ChipRowItem[] = [
  { key: 'all', label: '', icon: 'filter', iconLabel: 'Filter' },
  { key: 'edibility', label: 'Speisewert', icon: 'eat', on: true },
];

describe('ChipRowComponent', () => {
  it('shows each chip and names the chip with only an icon', async () => {
    const { container } = await render(ChipRowComponent, { inputs: { chips: CHIPS } });

    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speisewert' })).toHaveAttribute('aria-pressed', 'true');
    await noViolations(container);
  });

  it('gives the key of the pressed chip', async () => {
    const chosen = vi.fn();
    await render(ChipRowComponent, { inputs: { chips: CHIPS }, on: { chosen } });

    await userEvent.click(screen.getByRole('button', { name: 'Speisewert' }));

    expect(chosen).toHaveBeenCalledWith('edibility');
  });
});
