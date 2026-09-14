import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { SpeciesPickerComponent, type SpeciesPickerEntry } from './species-picker.component';

const SPECIES: SpeciesPickerEntry[] = [
  {
    value: 'steinpilz',
    name: 'Steinpilz',
    latin: 'Boletus edulis',
    levelText: 'essbar',
    levelColour: '#004225',
  },
  {
    value: 'fliegenpilz',
    name: 'Fliegenpilz',
    latin: 'Amanita muscaria',
    levelText: 'giftig',
    levelColour: '#8c1c16',
  },
];

describe('SpeciesPickerComponent', () => {
  it('zeigt Suchfeld und Artenzeilen', async () => {
    const { container } = await render(SpeciesPickerComponent, {
      inputs: { species: SPECIES, label: 'Art für die Karte' },
    });

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Fliegenpilz')).toBeInTheDocument();
    await noViolations(container);
  });

  it('meldet die gewählte Art', async () => {
    const { fixture } = await render(SpeciesPickerComponent, {
      inputs: { species: SPECIES, label: 'Art für die Karte' },
    });
    const chosen: string[] = [];
    fixture.componentInstance.chosen.subscribe((value) => chosen.push(value));

    await userEvent.click(screen.getByText('Steinpilz'));

    expect(chosen).toEqual(['steinpilz']);
  });

  it('filtert die Zeilen nach Name und lateinischem Namen', async () => {
    await render(SpeciesPickerComponent, {
      inputs: { species: SPECIES, label: 'Art für die Karte' },
    });

    await userEvent.type(screen.getByRole('textbox'), 'musc');

    expect(screen.queryByText('Steinpilz')).toBeNull();
    expect(screen.getByText('Fliegenpilz')).toBeInTheDocument();
  });

  it('zeigt eine Meldung ohne treffende Art', async () => {
    await render(SpeciesPickerComponent, {
      inputs: { species: SPECIES, label: 'Art für die Karte' },
    });

    await userEvent.type(screen.getByRole('textbox'), 'xyz');

    expect(screen.getByText('Keine Art passt zu dieser Auswahl')).toBeInTheDocument();
  });

  it('markiert die gewählte Zeile als aktiv', async () => {
    const { container } = await render(SpeciesPickerComponent, {
      inputs: { species: SPECIES, label: 'Art für die Karte', selected: 'steinpilz' },
    });

    expect(container.querySelector('.row--active')).not.toBeNull();
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const species: SpeciesPickerEntry[] = [
      { value: 'a', name: 'a', latin: 'a', levelText: 'edible', levelColour: '#004225' },
    ];
    const { container } = await render(SpeciesPickerComponent, {
      inputs: { species, label: 'species' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
