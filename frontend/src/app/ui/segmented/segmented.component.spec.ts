import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { SegmentedComponent, type SegmentOption } from './segmented.component';

const OPTIONEN: SegmentOption[] = [
  { value: 'vorhersage', label: 'Vorhersage' },
  { value: 'ebene', label: 'Ebene' },
  { value: 'kombination', label: 'Kombination' },
];

describe('SegmentedComponent', () => {
  it('führt die Wahl als tablist', async () => {
    const { container } = await render(SegmentedComponent, {
      inputs: { options: OPTIONEN, value: 'ebene', label: 'Darstellung' },
    });

    expect(screen.getByRole('tablist', { name: 'Darstellung' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Ebene' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Ebene' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: 'Vorhersage' })).toHaveAttribute('tabindex', '-1');
    await noViolations(container);
  });

  it('meldet einen Klick auf eine andere Wahl', async () => {
    const { fixture } = await render(SegmentedComponent, {
      inputs: { options: OPTIONEN, value: 'ebene', label: 'Darstellung' },
    });
    const selected: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));

    await userEvent.click(screen.getByRole('tab', { name: 'Kombination' }));

    expect(selected).toEqual(['kombination']);
  });

  it('wechselt mit den Pfeiltasten und läuft dabei um', async () => {
    const { fixture } = await render(SegmentedComponent, {
      inputs: { options: OPTIONEN, value: 'vorhersage', label: 'Darstellung' },
    });
    const selected: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));
    screen.getByRole('tab', { name: 'Vorhersage' }).focus();

    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{Enter}');

    expect(selected).toEqual(['ebene', 'kombination', 'vorhersage']);
  });

  it('zeigt ein gesperrtes Segment ohne Wahl anzunehmen', async () => {
    const { container, fixture } = await render(SegmentedComponent, {
      inputs: { options: OPTIONEN, value: null, label: 'Darstellung', locked: true },
    });
    const selected: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));

    expect(screen.getByRole('tab', { name: 'Ebene' })).toBeDisabled();
    expect(container.querySelector('.seg')).toHaveClass('seg--locked');
    expect(selected).toEqual([]);
    await noViolations(container);
  });

  it('trägt den Druckzustand an jeder Wahl', async () => {
    const { container } = await render(SegmentedComponent, {
      inputs: { options: OPTIONEN, value: 'ebene', label: 'Darstellung' },
    });

    const choice = container.querySelector('.seg__choice');
    expect(choice).toHaveClass('tap');
    expect(choice).toHaveAttribute('data-press', 'scale');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SegmentedComponent, {
      inputs: { options: [{ value: 'a', label: 'a' }], value: 'a', label: 'group' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
