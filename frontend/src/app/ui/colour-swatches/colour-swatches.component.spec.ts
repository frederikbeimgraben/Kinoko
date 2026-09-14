import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ColourSwatchesComponent, OBJECT_COLORS, type ColourSwatch } from './colour-swatches.component';

const COLORS: ColourSwatch[] = [
  { value: OBJECT_COLORS[0], label: 'Grün' },
  { value: OBJECT_COLORS[1], label: 'Bronze' },
];

describe('ColourSwatchesComponent', () => {
  it('führt die Farben als Auswahlgruppe', async () => {
    const { container } = await render(ColourSwatchesComponent, {
      inputs: { colors: COLORS, value: OBJECT_COLORS[0], label: 'Farbe' },
    });

    expect(screen.getByRole('radiogroup', { name: 'Farbe' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Grün' })).toHaveAttribute('aria-checked', 'true');
    await noViolations(container);
  });

  it('meldet die gewählte Farbe', async () => {
    const { fixture } = await render(ColourSwatchesComponent, {
      inputs: { colors: COLORS, value: OBJECT_COLORS[0], label: 'Farbe' },
    });
    const selected: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));

    await userEvent.click(screen.getByRole('radio', { name: 'Bronze' }));

    expect(selected).toEqual([OBJECT_COLORS[1]]);
  });

  it('trägt den Druckzustand an jedem Feld', async () => {
    const { container } = await render(ColourSwatchesComponent, {
      inputs: { colors: COLORS, value: OBJECT_COLORS[0], label: 'Farbe' },
    });

    const field = container.querySelector('.colors__field');
    expect(field).toHaveClass('tap');
    expect(field).toHaveAttribute('data-press', 'scale');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const swatches: ColourSwatch[] = [{ value: OBJECT_COLORS[0], label: 'green' }];
    const { container } = await render(ColourSwatchesComponent, {
      inputs: { colors: swatches, value: OBJECT_COLORS[0], label: 'colour' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
