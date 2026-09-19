import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ColourChangeComponent } from './colour-change.component';

const WHITE = [{ name: 'weiß', hex: '#f4efe2' }];
const BLUE = [{ name: 'blau', hex: '#3f6ea8' }];
const YELLOW = [{ name: 'gelb', hex: '#d9a441' }];

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null | undefined): CSSStyleDeclaration {
  if (element === null || element === undefined) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

describe('ColourChangeComponent', () => {
  it('nennt den Auslöser als Titel und den Weg der Farbe unter dem Feld', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Druck'],
        from: [WHITE],
        to: [BLUE],
        fromLabels: ['weiß'],
        toLabels: ['blau'],
        speed: ['sofort'],
        arrowLabel: 'zu',
      },
    });

    expect(screen.getByText('Druck')).toBeInTheDocument();
    expect(screen.getByText('weiß, dann blau · sofort')).toBeInTheDocument();
    await noViolations(container);
  });

  it('trägt Von und Nach als eigene Felder in Teilbreite, mit dem Pfeil dazwischen', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Druck'],
        from: [WHITE],
        to: [BLUE],
        fromLabels: ['weiß'],
        toLabels: ['blau'],
        speed: ['sofort'],
        arrowLabel: 'zu',
      },
    });

    const fields = container.querySelectorAll('.field');
    expect(fields).toHaveLength(2);
    expect(screen.getByRole('img', { name: 'weiß' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'blau' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'zu' })).toBeInTheDocument();
  });

  it('setzt den Weg der Farbe als eigene Zeile unter das Feld', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Druck'],
        from: [WHITE],
        to: [BLUE],
        fromLabels: ['weiß'],
        toLabels: ['blau'],
        speed: ['sofort'],
        arrowLabel: 'zu',
      },
    });

    const value = container.querySelector('.change__value');
    if (value === null) throw new Error('kein Feld');
    const caption = value.querySelector('.change__caption');
    expect(caption?.textContent).toBe('weiß, dann blau · sofort');
    // Die Zeile steht unter dem Feld: sie ist sein letztes Kind.
    expect(value.lastElementChild).toBe(caption);
  });

  it('stellt mehrere Auslöser desselben Teils als eigene Zeilen dar', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['KOH 3 %', 'Eisensulfat'],
        from: [WHITE, WHITE],
        to: [YELLOW, BLUE],
        fromLabels: ['weiß', 'weiß'],
        toLabels: ['gelb', 'blau'],
        speed: ['sofort', '30 s'],
        arrowLabel: 'zu',
      },
    });

    expect(container.querySelectorAll('app-list-row')).toHaveLength(2);
    expect(screen.getByText('KOH 3 %')).toBeInTheDocument();
    expect(screen.getByText('weiß, dann gelb · sofort')).toBeInTheDocument();
    expect(screen.getByText('weiß, dann blau · 30 s')).toBeInTheDocument();
  });

  it('nennt nur die neue Farbe als ein Feld, wenn die Ausgangsfarbe fehlt', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Anschnitt'],
        from: [[]],
        to: [BLUE],
        fromLabels: [''],
        toLabels: ['blau'],
        speed: ['3 min'],
        arrowLabel: 'zu',
      },
    });

    expect(screen.getByText('blau · 3 min')).toBeInTheDocument();
    expect(container.querySelectorAll('.field')).toHaveLength(1);
    expect(container.querySelector('app-svg-icon')).toBeNull();
    expect(screen.getByRole('img', { name: 'blau' })).toBeInTheDocument();
  });

  it('nennt nur die alte Farbe als ein Feld, wenn die Farbe bleibt', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Verletzung'],
        from: [WHITE],
        to: [[]],
        fromLabels: ['weiß'],
        toLabels: [''],
        speed: ['bleibt'],
        arrowLabel: 'zu',
      },
    });

    expect(screen.getByText('bleibt')).toBeInTheDocument();
    expect(container.querySelectorAll('.field')).toHaveLength(1);
    expect(container.querySelector('app-svg-icon')).toBeNull();
  });

  it('trägt das ganze Feld in Listengröße, wenn nur eine Farbe steht', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Verletzung'],
        from: [WHITE],
        to: [[]],
        fromLabels: ['weiß'],
        toLabels: [''],
        speed: ['bleibt'],
        arrowLabel: 'zu',
      },
    });

    const field = styleOf(container.querySelector('.field'));
    expect(field.getPropertyValue('inline-size')).toBe('var(--pilz-colour-width, 96px)');
    expect(field.getPropertyValue('block-size')).toBe('var(--pilz-colour-height, 30px)');
  });

  it('trennt zwei Zeilen mit dem Strich der zweiten', async () => {
    const { container } = await render(ColourChangeComponent, {
      inputs: {
        triggers: ['Druck', 'Anschnitt'],
        from: [WHITE, WHITE],
        to: [BLUE, BLUE],
        fromLabels: ['weiß', 'weiß'],
        toLabels: ['blau', 'blau'],
        speed: ['sofort', '1 min'],
        arrowLabel: 'zu',
      },
    });

    const rows = container.querySelectorAll('app-list-row');
    expect(styleOf(rows[0]).getPropertyValue('border-block-start')).toBe('');
    expect(styleOf(rows[1]).getPropertyValue('border-block-start')).toContain('var(--border-width)');
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(ColourChangeComponent, {
      providers: [EMPTY_CATALOG],
      inputs: {
        triggers: ['Pressure'],
        from: [WHITE],
        to: [BLUE],
        fromLabels: ['white'],
        toLabels: ['blue'],
        speed: ['instant'],
        arrowLabel: 'to',
      },
    });

    noGermanText(container);
  });
});
