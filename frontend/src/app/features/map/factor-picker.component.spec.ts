import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { readLayers } from '../../core/tiles/layers';
import { RAW_LAYERS } from '../../testing/map-doubles';
import { FactorPickerComponent } from './factor-picker.component';

const LAYERS = readLayers(RAW_LAYERS).layers;

describe('FactorPickerComponent', () => {
  it('shows each free source as a row of the sheet', async () => {
    const { container } = await render(FactorPickerComponent, {
      inputs: { open: true, layers: LAYERS },
    });

    expect(screen.getByRole('dialog', { name: 'Faktor wählen' })).toBeInTheDocument();
    expect(screen.getByText('Waldanteil')).toBeInTheDocument();
    expect(container.querySelectorAll('app-list-row')).toHaveLength(LAYERS.length);
    await noViolations(container);
  });

  it('leaves out a source that has a factor', async () => {
    await render(FactorPickerComponent, {
      inputs: { open: true, layers: LAYERS, assigned: new Set(['wald']) },
    });

    expect(screen.queryByText('Waldanteil')).toBeNull();
  });

  it('reports the chosen layer', async () => {
    const { fixture } = await render(FactorPickerComponent, {
      inputs: { open: true, layers: LAYERS },
    });
    const picks: string[] = [];
    fixture.componentInstance.chosen.subscribe((layer) => picks.push(layer.id));

    await userEvent.click(screen.getByRole('button', { name: /Waldanteil/ }));

    expect(picks).toEqual(['wald']);
  });

  it('fades the edges of the list when it scrolls', async () => {
    const { container } = await render(FactorPickerComponent, {
      inputs: { open: true, layers: LAYERS },
    });

    expect(container.querySelectorAll('.picker.scroll')).toHaveLength(1);
  });
});
