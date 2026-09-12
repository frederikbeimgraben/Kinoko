import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { SpeciesRowComponent } from './species-row.component';

@Component({
  imports: [SpeciesRowComponent],
  template: `
    <app-species-row
      name="Steinpilz"
      latin="Boletus edulis"
      [active]="true"
      [image]="'/api/species-images/bild-eins/thumb'"
    >
      <span tags>Vorhersage</span>
    </app-species-row>
  `,
})
class HostComponent {}

/** Dieselbe Zeile ohne Titelbild. Rechts steht dann nichts. */
@Component({
  imports: [SpeciesRowComponent],
  template: `<app-species-row name="Steinpilz" latin="Boletus edulis" />`,
})
class BareHostComponent {}

/**
 * Der längste Name im Katalog in einer schmalen Zeile. Die Namensspalte muss
 * `minmax(0, …)` tragen und das Bild eine feste Breite, sonst drückt der Name
 * die Zeile über den Rand oder das Bild die Spalte auf einen Buchstaben.
 */
@Component({
  imports: [SpeciesRowComponent],
  template: `
    <div style="inline-size: 240px">
      <app-species-row
        name="Schwarzhütiger Steinpilz aus dem Schönbuch"
        latin="Boletus aereus subsp. reticulatus"
        [image]="'/api/species-images/bild-eins/thumb'"
      />
    </div>
  `,
})
class NarrowHostComponent {}

describe('SpeciesRowComponent', () => {
  it('zeigt Name, lateinischen Namen, Titelbild und Tags', async () => {
    const { container } = await render(HostComponent);

    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(screen.getByText('Boletus edulis')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Steinpilz' })).toHaveAttribute(
      'src',
      '/api/species-images/bild-eins/thumb',
    );
    expect(screen.getByText('Vorhersage')).toBeInTheDocument();
    expect(container.querySelector('.speciesrow--active')).not.toBeNull();
    await noViolations(container);
  });

  it('lässt rechts nichts stehen, wo die Art kein Bild hat', async () => {
    const { container } = await render(BareHostComponent);

    expect(container.querySelector('.speciesrow__image')).toBeNull();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
  });

  it('lässt den längsten Namen in einer schmalen Zeile umbrechen, nicht die Spalte zusammenfallen', async () => {
    const { container } = await render(NarrowHostComponent);
    const [row] = container.getElementsByClassName('speciesrow');
    const [name] = container.getElementsByClassName('speciesrow__name');

    // Ohne `minmax(0, …)` an der ersten Spalte wächst die Zeile über die 240
    // Pixel hinaus; ohne feste Bildbreite schrumpft der Name auf einen Buchstaben.
    expect(getComputedStyle(row).gridTemplateColumns).toBe('minmax(0, 1fr) auto');
    expect(getComputedStyle(name).overflowWrap).toBe('anywhere');
    expect(container.querySelector('.speciesrow__image')).not.toBeNull();
  });

  it('markiert die aktive Art für Auge und Hilfsmittel', async () => {
    await render(HostComponent);

    const button = screen.getByRole('button', { name: /Steinpilz/ });
    expect(button).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('Aktiv')).toBeInTheDocument();
  });

  it('nimmt den Fokus auf Zuruf an, damit Pfeiltasten durch die Liste wandern', async () => {
    const { fixture } = await render(SpeciesRowComponent, {
      inputs: { name: 'Birkenpilz', latin: 'Leccinum scabrum' },
    });

    fixture.componentInstance.focus();

    expect(screen.getByRole('button', { name: /Birkenpilz/ })).toHaveFocus();
  });

  it('meldet die gewählte Art', async () => {
    const { fixture } = await render(SpeciesRowComponent, {
      inputs: { name: 'Pfifferling', latin: 'Cantharellus cibarius' },
    });
    let calls = 0;
    fixture.componentInstance.chosen.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button', { name: /Pfifferling/ }));

    expect(calls).toBe(1);
  });
});
