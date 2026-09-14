import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { CheckRowComponent } from './check-row.component';

describe('CheckRowComponent', () => {
  it('zeigt Titel und Unterzeile und meldet den Haken', async () => {
    const { container, fixture } = await render(CheckRowComponent, {
      inputs: { title: 'Profile ändern', subline: 'Merkmale, Verwechslungen, Quellen' },
    });
    await fixture.whenStable();
    const seen: boolean[] = [];
    fixture.componentInstance.toggled.subscribe((value) => seen.push(value));

    expect(screen.getByText('Merkmale, Verwechslungen, Quellen')).toBeInTheDocument();
    await noViolations(container);

    const box = screen.getByRole('checkbox', { name: /Profile ändern/ });
    expect(box).not.toBeChecked();
    expect(box.closest('.row')).toHaveClass('tap');
    expect(box.closest('.row')).toHaveAttribute('data-press', 'tint');

    await userEvent.click(box);

    expect(seen).toEqual([true]);
  });

  it('zeigt einen bereits gesetzten Haken', async () => {
    const { fixture } = await render(CheckRowComponent, {
      inputs: { title: 'Bilder hochladen', checked: true },
    });
    await fixture.whenStable();

    expect(screen.getByRole('checkbox', { name: /Bilder hochladen/ })).toBeChecked();
  });

  it('lässt sich per Taste umschalten', async () => {
    const { fixture } = await render(CheckRowComponent, { inputs: { title: 'Rollen setzen' } });
    await fixture.whenStable();
    const seen: boolean[] = [];
    fixture.componentInstance.toggled.subscribe((value) => seen.push(value));
    const box = screen.getByRole('checkbox', { name: /Rollen setzen/ });

    box.focus();
    await userEvent.keyboard(' ');

    expect(seen).toEqual([true]);
  });

  it('lässt sich nicht umschalten, solange die Zeile gesperrt ist', async () => {
    const { fixture } = await render(CheckRowComponent, {
      inputs: { title: 'Texte ändern', checked: true, locked: true },
    });
    await fixture.whenStable();
    let calls = 0;
    fixture.componentInstance.toggled.subscribe(() => (calls += 1));

    const box = screen.getByRole('checkbox', { name: /Texte ändern/ });
    await userEvent.click(box);

    expect(box).toBeDisabled();
    expect(box).toBeChecked();
    expect(calls).toBe(0);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container, fixture } = await render(CheckRowComponent, {
      inputs: { title: 'Row', subline: 'Sub' },
      providers: [EMPTY_CATALOG],
    });
    await fixture.whenStable();

    noGermanText(container);
  });
});
