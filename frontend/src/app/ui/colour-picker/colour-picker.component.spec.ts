import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ColourPickerComponent, type ColourPickerSwatch } from './colour-picker.component';

const COLOURS: ColourPickerSwatch[] = [
  { value: '#f3efe6', label: 'Weiß' },
  { value: '#e8d9b5', label: 'Creme' },
  { value: '#6b4423', label: 'Braun' },
];

describe('ColourPickerComponent', () => {
  it('zeigt die Standardfarben mit Namen', async () => {
    const { container } = await render(ColourPickerComponent, {
      inputs: { colours: COLOURS, value: '#6b4423', label: 'Hut' },
    });

    expect(screen.getByRole('radiogroup', { name: 'Hut' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Braun' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Creme')).toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet die gewählte Farbe', async () => {
    const { fixture } = await render(ColourPickerComponent, {
      inputs: { colours: COLOURS, value: '#6b4423', label: 'Hut' },
    });
    const selected: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => selected.push(value));

    await userEvent.click(screen.getByRole('radio', { name: 'Weiß' }));

    expect(selected).toEqual(['#f3efe6']);
  });

  it('zeigt ohne nächste Töne keinen Abschnitt dafür', async () => {
    const { container } = await render(ColourPickerComponent, {
      inputs: { colours: COLOURS, value: '#6b4423', label: 'Hut' },
    });

    expect(container.querySelector('.picker__nearest')).toBeNull();
  });

  it('zeigt die nächsten Katalogtöne als Vorschau', async () => {
    const { container } = await render(ColourPickerComponent, {
      inputs: { colours: COLOURS, value: '#6b4423', label: 'Hut', nearest: ['#5e3d22', '#4a3220'] },
    });

    expect(container.querySelector('.picker__nearest')).not.toBeNull();
    expect(container.querySelectorAll('.tone')).toHaveLength(2);
  });

  it('trägt den Druckzustand an jeder Farbe', async () => {
    const { container } = await render(ColourPickerComponent, {
      inputs: { colours: COLOURS, value: '#6b4423', label: 'Hut' },
    });

    const swatch = container.querySelector('.swatch');
    expect(swatch).toHaveClass('tap');
    expect(swatch).toHaveAttribute('data-press', 'scale');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const colours: ColourPickerSwatch[] = [{ value: '#ffffff', label: 'white' }];
    const { container } = await render(ColourPickerComponent, {
      inputs: { colours, value: '#ffffff', label: 'colour', nearest: ['#eeeeee'] },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
