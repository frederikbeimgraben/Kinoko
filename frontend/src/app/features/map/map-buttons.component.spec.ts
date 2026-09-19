import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { MapButtonsComponent } from './map-buttons.component';

describe('MapButtonsComponent', () => {
  it('zeigt Ebenen und Ort und meldet einen Tipp', async () => {
    const { container, fixture } = await render(MapButtonsComponent, {
      inputs: { locationAllowed: true },
    });
    let toggled = 0;
    let located = 0;
    fixture.componentInstance.layersToggled.subscribe(() => (toggled += 1));
    fixture.componentInstance.located.subscribe(() => (located += 1));

    await userEvent.click(screen.getByRole('button', { name: 'Ebenen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Standort' }));

    expect(toggled).toBe(1);
    expect(located).toBe(1);
    await noViolations(container);
  });

  it('lässt Standort weg, wenn die Karte kein Blatt darüber zeigt', async () => {
    await render(MapButtonsComponent, { inputs: { showsLocation: false } });

    expect(screen.queryByRole('button', { name: 'Standort' })).not.toBeInTheDocument();
  });

  it('sperrt Standort ohne Erlaubnis', async () => {
    await render(MapButtonsComponent, { inputs: { locationAllowed: false } });

    expect(screen.getByRole('button', { name: 'Standort' })).toBeDisabled();
  });

  it('zeigt Eintragen nur, wenn showAdd gesetzt ist, und meldet den Tipp', async () => {
    const { fixture, rerender } = await render(MapButtonsComponent, { inputs: { showAdd: false } });

    expect(screen.queryByRole('button', { name: 'Eintragen' })).not.toBeInTheDocument();

    await rerender({ inputs: { showAdd: true } });
    let added = 0;
    fixture.componentInstance.add.subscribe(() => (added += 1));
    await userEvent.click(screen.getByRole('button', { name: 'Eintragen' }));

    expect(added).toBe(1);
  });

  it('zeigt den Kompass nur gedreht, mit der Nadel der Drehung, und meldet den Tipp', async () => {
    const { fixture, rerender } = await render(MapButtonsComponent, { inputs: { turned: false } });

    expect(screen.queryByRole('button', { name: 'Nach Norden drehen' })).not.toBeInTheDocument();

    await rerender({ inputs: { turned: true, needle: 30 } });
    let northed = 0;
    fixture.componentInstance.northed.subscribe(() => (northed += 1));
    const compass = screen.getByRole('button', { name: 'Nach Norden drehen' });
    expect(compass.querySelector('app-svg-icon')).toHaveStyle({ rotate: '30deg' });

    await userEvent.click(compass);

    expect(northed).toBe(1);
  });
});
