import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { FilterChipComponent } from './filter-chip.component';

describe('FilterChipComponent', () => {
  it('zeigt die Beschriftung', async () => {
    const { container } = await render(FilterChipComponent, {
      inputs: { label: 'essbar' },
    });

    expect(screen.getByText('essbar')).toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet das Entfernen über den X-Knopf', async () => {
    const { fixture } = await render(FilterChipComponent, {
      inputs: { label: 'essbar' },
    });
    let calls = 0;
    fixture.componentInstance.removed.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button'));

    expect(calls).toBe(1);
  });

  it('trägt den Druckzustand am X-Knopf', async () => {
    const { container } = await render(FilterChipComponent, {
      inputs: { label: 'essbar' },
    });

    const button = container.querySelector('button');
    expect(button).toHaveClass('tap');
    expect(button).toHaveAttribute('data-press', 'scale');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(FilterChipComponent, {
      inputs: { label: 'edible' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
