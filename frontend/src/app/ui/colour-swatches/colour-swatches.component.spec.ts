import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ColourSwatchesComponent, OBJECT_COLOURS, type ColourSwatch } from './colour-swatches.component';

const COLORS: ColourSwatch[] = [
  { value: OBJECT_COLOURS[0], label: 'Grün' },
  { value: OBJECT_COLOURS[1], label: 'Bronze' },
];

describe('ColourSwatchesComponent', () => {
  it('führt die Farben als Auswahlgruppe', async () => {
    const { container } = await render(ColourSwatchesComponent, {
      inputs: { colours: COLORS, value: OBJECT_COLOURS[0], label: 'Farbe' },
    });

    expect(screen.getByRole('radiogroup', { name: 'Farbe' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Grün' })).toHaveAttribute('aria-checked', 'true');
    await noViolations(container);
  });

  it('meldet die gewählte Farbe', async () => {
    const { fixture } = await render(ColourSwatchesComponent, {
      inputs: { colours: COLORS, value: OBJECT_COLOURS[0], label: 'Farbe' },
    });
    const selected: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));

    await userEvent.click(screen.getByRole('radio', { name: 'Bronze' }));

    expect(selected).toEqual([OBJECT_COLOURS[1]]);
  });

  it('setzt einen Kreis am Berührungspunkt statt der Verkleinerung', async () => {
    const { container } = await render(ColourSwatchesComponent, {
      inputs: { colours: COLORS, value: OBJECT_COLOURS[0], label: 'Farbe' },
    });

    const field = container.querySelector<HTMLElement>('.colours__field');
    if (field === null) throw new Error('kein Feld');
    expect(field).toHaveClass('tap');
    expect(field).not.toHaveAttribute('data-press');

    vi.spyOn(field, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 28,
      height: 28,
      right: 28,
      bottom: 28,
      toJSON: () => undefined,
    });
    field.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 14, clientY: 14 }));

    expect(field.querySelector('.ripple')).not.toBeNull();
  });

  it('trägt die Größe als Kreisdurchmesser', async () => {
    const { container } = await render(ColourSwatchesComponent, {
      inputs: { colours: COLORS, value: OBJECT_COLOURS[0], label: 'Farbe', size: 'l' },
    });

    expect(container.querySelector('.colours__field')).toHaveClass('colours__field--l');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const swatches: ColourSwatch[] = [{ value: OBJECT_COLOURS[0], label: 'green' }];
    const { container } = await render(ColourSwatchesComponent, {
      inputs: { colours: swatches, value: OBJECT_COLOURS[0], label: 'colour' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
