import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { catalogueProviders, catalogueReady } from '../../testing/catalogue-double';
import { noViolations } from '../../testing/axe';
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

  it('zeigt den Filter-Knopf ohne Suchtext', async () => {
    await build('');
    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
  });

  it('verbirgt den Filter-Knopf während der Suche', async () => {
    await build('steinpilz');
    expect(screen.queryByRole('button', { name: 'Filter' })).not.toBeInTheDocument();
  });

  it('öffnet das Filterblatt über den Filter-Knopf', async () => {
    const { container, filter } = await build();
    expect(filter.open()).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }));

    expect(filter.open()).toBe(true);
    await noViolations(container);
  });

  it('trägt eine gewählte Marke und nimmt sie beim Entfernen zurück', async () => {
    const { filter } = await build();
    filter.toggle('edibility', 'edible');

    const chip = await screen.findByRole('button', { name: 'Entfernen' });
    await userEvent.click(chip);

    expect(filter.chosenIn('edibility').has('edible')).toBe(false);
  });
});
