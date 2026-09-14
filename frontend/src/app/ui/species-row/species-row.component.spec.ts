import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { SpeciesRowComponent, type SpeciesRowSpecies } from './species-row.component';

const STEINPILZ: SpeciesRowSpecies = {
  name: 'Steinpilz',
  latin: 'Boletus edulis',
  levelText: 'essbar',
  levelColour: 'var(--color-success)',
  image: '/api/species-images/bild-eins/thumb',
};

@Component({
  imports: [SpeciesRowComponent],
  template: `
    <app-species-row [species]="species">
      <span trail>Kurve</span>
    </app-species-row>
  `,
})
class SlottedHostComponent {
  readonly species = STEINPILZ;
}

describe('SpeciesRowComponent', () => {
  it('zeigt Name, lateinischen Namen, Speisewert und Titelbild', async () => {
    const { container } = await render(SpeciesRowComponent, { inputs: { species: STEINPILZ } });

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Boletus edulis')).toBeInTheDocument();
    expect(screen.getByText('essbar')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', STEINPILZ.image);
    await noViolations(container);
  });

  it('lässt rechts nichts stehen, wo die Art kein Bild hat', async () => {
    const { container } = await render(SpeciesRowComponent, {
      inputs: { species: { ...STEINPILZ, image: null } },
    });

    expect(container.querySelector('.row__image')).toBeNull();
  });

  it('bleibt ohne Inhalt für den Hinten-Slot unsichtbar', async () => {
    const { container } = await render(SpeciesRowComponent, { inputs: { species: STEINPILZ } });

    expect(container.querySelector('.row__trail')).toBeEmptyDOMElement();
  });

  it('nimmt den Hinten-Slot vor dem Bild an', async () => {
    await render(SlottedHostComponent);

    expect(screen.getByText('Kurve')).toBeInTheDocument();
  });

  it('bricht den längsten Namen um, statt die Zeile zu sprengen', async () => {
    const longName = 'Schwarzhütiger Steinpilz aus dem Schönbuch';
    await render(SpeciesRowComponent, { inputs: { species: { ...STEINPILZ, name: longName } } });

    expect(getComputedStyle(screen.getByText(longName)).overflowWrap).toBe('anywhere');
  });

  it('markiert die aktive Art für Hilfsmittel', async () => {
    await render(SpeciesRowComponent, { inputs: { species: STEINPILZ, active: true } });

    const button = screen.getByRole('button', { name: /Steinpilz/ });
    expect(button).toHaveAttribute('aria-current', 'true');
    expect(button).toHaveClass('row--active');
  });

  it('nimmt den Fokus auf Zuruf an, damit Pfeiltasten durch die Liste wandern', async () => {
    const { fixture } = await render(SpeciesRowComponent, { inputs: { species: STEINPILZ } });

    fixture.componentInstance.focus();

    expect(screen.getByRole('button', { name: /Steinpilz/ })).toHaveFocus();
  });

  it('meldet die gewählte Art und trägt den Druckzustand', async () => {
    const { fixture } = await render(SpeciesRowComponent, { inputs: { species: STEINPILZ } });
    let calls = 0;
    fixture.componentInstance.chosen.subscribe(() => (calls += 1));
    const button = screen.getByRole('button', { name: /Steinpilz/ });

    await userEvent.click(button);

    expect(calls).toBe(1);
    expect(button).toHaveClass('tap');
    expect(button).toHaveAttribute('data-press', 'tint');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SpeciesRowComponent, {
      inputs: {
        species: { name: 'Row', latin: 'Rowus latinus', levelText: 'ok', levelColour: 'green' },
      },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
