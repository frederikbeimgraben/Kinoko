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
  image: '/photos/bild-eins/list',
};

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null | undefined): CSSStyleDeclaration {
  if (element === null || element === undefined) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

/** Zwei Zeilen übereinander: nur so zeigt sich die Trennlinie dazwischen. */
@Component({
  imports: [SpeciesRowComponent],
  template: `
    <app-species-row [species]="species" />
    <app-species-row [species]="species" />
  `,
})
class StackHostComponent {
  readonly species = STEINPILZ;
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

  it('reserviert ohne Titelbild keinen Platz rechts', async () => {
    const { container } = await render(SpeciesRowComponent, {
      inputs: { species: { ...STEINPILZ, image: null } },
    });

    expect(container.querySelector('app-private-image')).toBeNull();
    expect(container.querySelector('.row__image')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
  });

  it('lässt ohne Titelbild kein Element für die Bildspalte im Baum', async () => {
    const { container } = await render(SpeciesRowComponent, {
      inputs: { species: { ...STEINPILZ, image: null } },
    });

    const children = Array.from(container.querySelectorAll('.row > *'));
    expect(children.some((child) => child.classList.contains('row__image'))).toBe(false);
  });

  it('hält das Titelbild bei einer Art mit Foto 44 × 44', async () => {
    const { container } = await render(SpeciesRowComponent, { inputs: { species: STEINPILZ } });

    const image = styleOf(container.querySelector('.row__image'));
    expect(image.getPropertyValue('inline-size')).toBe('var(--size-thumb)');
    expect(image.getPropertyValue('block-size')).toBe('var(--size-thumb)');
  });

  it('steht so hoch wie eine hohe Zeile, den Rand eingerechnet', async () => {
    const { container } = await render(StackHostComponent);

    const rows = container.querySelectorAll('app-species-row');
    const first = styleOf(rows[0]);
    expect(first.getPropertyValue('block-size')).toBe('var(--size-row-tall)');
    expect(first.boxSizing).toBe('border-box');
    expect(first.getPropertyValue('border-block-end')).toContain('var(--border-width)');
    expect(styleOf(rows[1]).getPropertyValue('border-block-end')).toBe('0px');
  });

  it('setzt Name und lateinischen Namen in die Schriftgrade des Bretts', async () => {
    const { container } = await render(SpeciesRowComponent, { inputs: { species: STEINPILZ } });

    const name = styleOf(container.querySelector('.row__name'));
    expect(name.fontSize).toBe('var(--fs-row-title)');
    expect(name.fontWeight).toBe('var(--fw-medium)');
    const latin = styleOf(container.querySelector('.row__latin'));
    expect(latin.fontSize).toBe('var(--fs-row-latin)');
    expect(latin.fontStyle).toBe('italic');
  });

  it('schneidet den längsten Namen mit einer Ellipse ab, statt ihn umzubrechen', async () => {
    const longName = 'Schwarzhütiger Steinpilz aus dem Schönbuch';
    await render(SpeciesRowComponent, { inputs: { species: { ...STEINPILZ, name: longName } } });

    const name = styleOf(screen.getByText(longName));
    expect(name.textOverflow).toBe('ellipsis');
    expect(name.whiteSpace).toBe('nowrap');
    expect(name.overflow).toBe('hidden');
  });

  it('lässt die Plakette bei einer Art ohne Angabe weg', async () => {
    const { container } = await render(SpeciesRowComponent, {
      inputs: { species: STEINPILZ, muted: true },
    });

    expect(screen.queryByText('essbar')).not.toBeInTheDocument();
    expect(container.querySelector('.row__marks')).toBeNull();
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
