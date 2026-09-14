import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ColourChangeComponent } from './colour-change.component';

const WHITE = [{ name: 'weiß', hex: '#f4efe2' }];
const BLUE = [{ name: 'blau', hex: '#3f6ea8' }];
const YELLOW = [{ name: 'gelb', hex: '#d9a441' }];

describe('ColourChangeComponent', () => {
  it('stellt Auslöser, von, Pfeil, nach und Dauer je Zeile dar', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Druck'],
        from: [WHITE],
        to: [BLUE],
        fromLabels: ['Farbe: weiß'],
        toLabels: ['Farbe: blau'],
        speed: ['sofort'],
        arrowLabel: 'wird zu',
      },
    });

    expect(screen.getByText('Druck')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Farbe: weiß' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'wird zu' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Farbe: blau' })).toBeInTheDocument();
    expect(screen.getByText('sofort')).toBeInTheDocument();
    await noViolations(container);
  });

  it('stellt mehrere Auslöser desselben Teils als eigene Zeilen dar', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['KOH 3 %', 'Eisensulfat'],
        from: [WHITE, WHITE],
        to: [YELLOW, BLUE],
        fromLabels: ['Farbe: weiß', 'Farbe: weiß'],
        toLabels: ['Farbe: gelb', 'Farbe: blau'],
        speed: ['sofort', '30 s'],
        arrowLabel: 'wird zu',
      },
    });

    expect(container.querySelectorAll('.row')).toHaveLength(2);
    expect(screen.getByText('KOH 3 %')).toBeInTheDocument();
    expect(screen.getByText('Eisensulfat')).toBeInTheDocument();
    expect(screen.getByText('30 s')).toBeInTheDocument();
  });

  it('lässt den Pfeil weg, wenn die Ausgangsfarbe fehlt', async () => {
    // Kein Profil des Katalogs nennt eine Ausgangsfarbe. Der Pfeil stand
    // darum immer allein vor der einzigen Fläche.
    await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Anschnitt'],
        from: [[]],
        to: [BLUE],
        fromLabels: [''],
        toLabels: ['Farbe: blau'],
        speed: ['3 min'],
        arrowLabel: 'wird zu',
      },
    });

    expect(screen.queryByRole('img', { name: 'wird zu' })).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Farbe: blau' })).toBeInTheDocument();
  });

  it('lässt den Pfeil weg, wenn die Farbe bleibt', async () => {
    await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Verletzung'],
        from: [WHITE],
        to: [[]],
        fromLabels: ['Farbe: weiß'],
        toLabels: [''],
        speed: ['bleibt'],
        arrowLabel: 'wird zu',
      },
    });

    expect(screen.queryByRole('img', { name: 'wird zu' })).not.toBeInTheDocument();
    expect(screen.getByText('bleibt')).toBeInTheDocument();
  });

  it('nimmt die letzte Zeile ohne unteren Rand', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Druck', 'Anschnitt'],
        from: [WHITE, WHITE],
        to: [BLUE, BLUE],
        fromLabels: ['Farbe: weiß', 'Farbe: weiß'],
        toLabels: ['Farbe: blau', 'Farbe: blau'],
        speed: ['sofort', '1 min'],
        arrowLabel: 'wird zu',
      },
    });

    const rows = container.querySelectorAll('.row');
    expect(getComputedStyle(rows[0]).borderBlockEndWidth).not.toBe('0px');
    expect(getComputedStyle(rows[1]).borderBlockEndWidth).toBe('0px');
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(ColourChangeComponent, {
      providers: [EMPTY_CATALOG],
      inputs: {
        triggers: ['Pressure'],
        from: [WHITE],
        to: [BLUE],
        fromLabels: ['Colour: white'],
        toLabels: ['Colour: blue'],
        speed: ['instant'],
        arrowLabel: 'turns into',
      },
    });

    noGermanText(container);
  });
});
