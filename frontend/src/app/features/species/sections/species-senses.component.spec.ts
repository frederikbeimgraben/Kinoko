import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { noViolations } from '../../../testing/axe';
import { CATALOGUE_TEXT } from '../../../testing/catalogue-text-double';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesSensesComponent } from './species-senses.component';

function term(slug: string, name: string, kind: 'smell' | 'taste') {
  return { term: { id: slug, slug, name, kind }, fromExperience: false };
}

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  smellText: 'Frisch angenehm pilzig.',
  tasteText: 'Mild und nussig.',
  terms: [term('pilzig', 'Pilzig', 'smell'), term('mild', 'Mild', 'taste')],
});

async function build(species = STONE) {
  return render(SpeciesSensesComponent, { providers: [CATALOGUE_TEXT], inputs: { species } });
}

describe('SpeciesSensesComponent', () => {
  it('zeigt Geruch und Geschmack als Zeilen einer Gruppe mit dem Satz darunter', async () => {
    const { container } = await build();

    expect(container.querySelectorAll('app-row-group app-list-row')).toHaveLength(2);
    expect(screen.getByText('Frisch angenehm pilzig.')).toBeInTheDocument();
    expect(screen.getByText('Mild und nussig.')).toBeInTheDocument();
    expect(container.querySelector('app-tag-list')).toBeNull();
    await noViolations(container);
  });

  it('nimmt die Begriffe, wo der Satz fehlt', async () => {
    await build(speciesEntry({ ...STONE, smellText: null }));

    expect(screen.getByText('Pilzig')).toBeInTheDocument();
  });

  it('zeigt auf Englisch die übersetzten Begriffe statt des deutschen Satzes', async () => {
    const { fixture } = await build();
    const i18n = TestBed.inject(I18nService);
    i18n.setLocale('en');
    await vi.waitFor(() => {
      expect(i18n.locale()).toBe('en');
    });
    fixture.detectChanges();

    expect(screen.getByText('Mushroomy')).toBeInTheDocument();
    expect(screen.queryByText('Frisch angenehm pilzig.')).toBeNull();
    i18n.setLocale('de');
  });

  it('lässt einen Sinn ohne Angabe weg', async () => {
    const { container } = await build(speciesEntry({ ...STONE, tasteText: null, terms: [] }));

    expect(container.querySelectorAll('app-list-row')).toHaveLength(1);
  });
});
