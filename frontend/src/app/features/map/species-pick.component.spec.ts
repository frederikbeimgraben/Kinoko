import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { SpeciesPickerEntry } from '../../ui/species-picker/species-picker.component';
import { SpeciesPickComponent } from './species-pick.component';

function entry(value: string, name: string, latin: string, alias = ''): SpeciesPickerEntry {
  return { value, name, latin, alias, levelText: '', levelColour: '' };
}

const ENGLISH = [
  entry('boletus-edulis', 'Boletus edulis', 'Boletus edulis', 'Steinpilz'),
  entry('cantharellus-cibarius', 'Cantharellus cibarius', 'Cantharellus cibarius', 'Pfifferling'),
];

describe('SpeciesPickComponent', () => {
  it('shows the German name under a Latin title, not the Latin name two times', async () => {
    await render(SpeciesPickComponent, { inputs: { species: ENGLISH, label: 'Species' } });

    expect(screen.getAllByText('Boletus edulis')).toHaveLength(1);
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
  });

  it('shows the Latin name under a German title', async () => {
    await render(SpeciesPickComponent, {
      inputs: { species: [entry('boletus-edulis', 'Steinpilz', 'Boletus edulis')], label: 'Art' },
    });

    expect(screen.getByText('Boletus edulis')).toBeInTheDocument();
  });

  it('finds a species by its German name in English', async () => {
    await render(SpeciesPickComponent, { inputs: { species: ENGLISH, label: 'Species' } });

    await userEvent.type(screen.getByRole('textbox'), 'pfiff');

    expect(screen.getByText('Cantharellus cibarius')).toBeInTheDocument();
    expect(screen.queryByText('Boletus edulis')).toBeNull();
  });
});
