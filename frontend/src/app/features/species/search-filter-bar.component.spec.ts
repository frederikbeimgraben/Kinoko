import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { SpeciesSearchFilterBarComponent } from './search-filter-bar.component';
import { SpeciesFilterState } from './filter.state';

async function build(value = ''): Promise<{ container: Element; filter: SpeciesFilterState }> {
  const { container } = await render(SpeciesSearchFilterBarComponent, {
    inputs: { value, placeholder: 'Suchen' },
    providers: [...catalogueProviders()],
  });
  await catalogueReady();
  return { container, filter: TestBed.inject(SpeciesFilterState) };
}

describe('SpeciesSearchFilterBarComponent', () => {
  beforeEach(() => {
    localStorage.removeItem('pilzkarte.speciesfilter');
  });

  it('zeigt das Suchfeld mit Platzhalter und meldet Eingaben', async () => {
    const { fixture } = await render(SpeciesSearchFilterBarComponent, {
      inputs: { value: '', placeholder: 'Suchen' },
      providers: [...catalogueProviders()],
    });
    await catalogueReady();
    const changes: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => changes.push(value));

    await userEvent.type(screen.getByPlaceholderText('Suchen'), 'a');

    expect(changes).toEqual(['a']);
  });

  it('zeigt ein Zeichen je Filtergruppe, das Brett zuerst', async () => {
    const { container } = await build('');

    const chips = [...container.querySelectorAll('.chiprow > *')];
    expect(chips).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speisewert' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hutform' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Farbe' })).toBeInTheDocument();
    await noViolations(container);
  });

  it('verbirgt die Zeichen während der Suche', async () => {
    await build('steinpilz');
    expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument();
  });

  it('öffnet das Filterblatt über ein Zeichen und meldet die Gruppe', async () => {
    const { fixture } = await render(SpeciesSearchFilterBarComponent, {
      inputs: { value: '' },
      providers: [...catalogueProviders()],
    });
    await catalogueReady();
    const filter = TestBed.inject(SpeciesFilterState);
    const opened: string[] = [];
    fixture.componentInstance.groupOpened.subscribe((key) => opened.push(key));
    expect(filter.open()).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));

    expect(filter.open()).toBe(true);
    expect(opened).toEqual(['all']);
  });

  it('zeigt die Gruppe mit Wahl mit ihrem Wert, an', async () => {
    const { filter } = await build();
    filter.toggle('edibility', 'edible');

    expect(await screen.findByRole('button', { name: 'Speisewert · essbar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Speisewert · essbar' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Hutform' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SpeciesSearchFilterBarComponent, {
      inputs: { value: '' },
      providers: [...catalogueProviders(), EMPTY_CATALOG],
    });
    await catalogueReady();

    noGermanText(container);
  });
});
