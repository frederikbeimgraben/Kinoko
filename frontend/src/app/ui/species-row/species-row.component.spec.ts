import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { SpeciesRowComponent, type SpeciesRowSpecies } from './species-row.component';

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

const STEINPILZ: SpeciesRowSpecies = {
  name: 'Steinpilz',
  latin: 'Boletus edulis',
  levelText: 'essbar',
  levelColour: 'var(--color-success)',
  levelKind: 'ok',
  colour: '#7a5230',
  image: '/photos/bild-eins/list',
};

@Component({
  imports: [SpeciesRowComponent],
  template: `
    <app-species-row [species]="species">
      <span trail>{{ mark }}</span>
    </app-species-row>
  `,
})
class TrailHostComponent {
  readonly species = STEINPILZ;
  readonly mark = 'Merkzeichen';
}

describe('SpeciesRowComponent', () => {
  it('zeigt Name, lateinischen Namen, Speisewert und Titelbild', async () => {
    const { container } = await render(SpeciesRowComponent, { inputs: { species: STEINPILZ } });

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Boletus edulis')).toBeInTheDocument();
    expect(screen.getByText('essbar')).toBeInTheDocument();
    expect(container.querySelector('app-private-image')).not.toBeNull();
    await noViolations(container);
  });

  it('zeigt ohne Titelbild das Ersatzsymbol, nicht die Bildspalte leer', async () => {
    const { container } = await render(SpeciesRowComponent, {
      inputs: { species: { ...STEINPILZ, image: null } },
    });

    expect(container.querySelector('app-private-image')).not.toBeNull();
    expect(container.querySelector('.private__fallback')).not.toBeNull();
  });

  it('setzt Name und lateinischen Namen in die Schriftgrade des Bretts', async () => {
    const { container } = await render(SpeciesRowComponent, { inputs: { species: STEINPILZ } });

    const name = styleOf(container.querySelector('.row__name'));
    expect(name.fontSize).toBe('16px');
    const latin = styleOf(container.querySelector('.row__latin'));
    expect(latin.fontSize).toBe('14px');
    expect(latin.fontStyle).toBe('italic');
  });

  it('schneidet den längsten Namen mit einer Ellipse ab, statt ihn umzubrechen', async () => {
    const longName = 'Schwarzhütiger Steinpilz aus dem Schönbuch';
    await render(SpeciesRowComponent, { inputs: { species: { ...STEINPILZ, name: longName } } });

    const name = getComputedStyle(screen.getByText(longName));
    expect(name.textOverflow).toBe('ellipsis');
    expect(name.whiteSpace).toBe('nowrap');
    expect(name.overflow).toBe('hidden');
  });

  it('lässt die Plakette bei einer Art ohne Angabe weg', async () => {
    const { container } = await render(SpeciesRowComponent, {
      inputs: { species: STEINPILZ, muted: true },
    });

    expect(screen.queryByText('essbar')).not.toBeInTheDocument();
    expect(container.querySelector('.row__badge')).toBeNull();
  });

  it('reicht die Fläche der Plakette durch', async () => {
    const { container } = await render(SpeciesRowComponent, {
      inputs: { species: { ...STEINPILZ, levelBackground: '#16291f' } },
    });

    const pill = container.querySelector<HTMLElement>('.level');
    expect(pill?.style.getPropertyValue('--pilz-level-area')).toBe('#16291f');
  });

  it('markiert die aktive Art für Hilfsmittel', async () => {
    await render(SpeciesRowComponent, { inputs: { species: STEINPILZ, active: true } });

    const button = screen.getByRole('button', { name: /Steinpilz/ });
    expect(button).toHaveAttribute('aria-current', 'true');
    expect(button).toHaveClass('row--active');
  });

  it('trägt den Aufdruck jeder tippbaren Zeile', async () => {
    const { container } = await render(SpeciesRowComponent, { inputs: { species: STEINPILZ } });

    expect(container.querySelector('button.row')).toHaveAttribute('appRipple', '');
  });

  it('gibt den hinteren Steckplatz an aufrufenden Inhalt weiter', async () => {
    const { container } = await render(TrailHostComponent);

    expect(container.querySelector('.row__trail')?.textContent).toContain('Merkzeichen');
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
