import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { noViolations } from '../../../testing/axe';
import { speciesEntry } from '../../../testing/species-fixture';
import { SpeciesTraitsComponent } from './species-traits.component';

const STONE = speciesEntry({
  slug: 'boletus-edulis',
  name: 'Steinpilz',
  scientificName: 'Boletus edulis',
  traits: [
    { key: 'stem', text: 'Bauchig bis keulig, hell mit feinem weißem Netz.' },
    { key: 'cap', text: 'Halbkugelig, später polsterförmig.' },
    { key: 'flesh', text: 'Weiß, fest, unveränderlich.' },
    { key: 'tubes', text: 'Weiß, später olivgelb.' },
    { key: 'habitat', text: 'Bei Fichte und Buche.' },
    { key: 'smell', text: 'Angenehm.' },
  ],
});

describe('SpeciesTraitsComponent', () => {
  it('zeigt jeden Teil als Zeile einer Gruppe, in der Ordnung des Körpers', async () => {
    const { container } = await render(SpeciesTraitsComponent, { inputs: { species: STONE } });

    const rows = [...container.querySelectorAll('app-row-group app-list-row.trait')];
    expect(rows.map((row) => row.querySelector('.row__sub')?.textContent)).toEqual([
      'Halbkugelig, später polsterförmig.',
      'Weiß, später olivgelb.',
      'Bauchig bis keulig, hell mit feinem weißem Netz.',
      'Weiß, fest, unveränderlich.',
      'Bei Fichte und Buche.',
    ]);
    expect(screen.queryByText('Angenehm.')).toBeNull();
    await noViolations(container);
  });

  it('lässt einen Teil ohne Satz weg', async () => {
    const { container } = await render(SpeciesTraitsComponent, {
      inputs: { species: speciesEntry({ ...STONE, traits: [STONE.traits[0]] }) },
    });

    expect(container.querySelectorAll('app-list-row')).toHaveLength(1);
  });

  it('zeigt keinen Abschnitt ohne einen Satz', async () => {
    const { container } = await render(SpeciesTraitsComponent, {
      inputs: { species: speciesEntry({ ...STONE, traits: [] }) },
    });

    expect(container.querySelector('app-section')).toBeNull();
  });

  it('zeigt die Stielmerkmale nach dem Stiel, die Merkmale gegen Knollenblätterpilze zuerst', async () => {
    const { container } = await render(SpeciesTraitsComponent, {
      inputs: {
        species: speciesEntry({
          ...STONE,
          stemFeatures: [
            { feature: 'hollow', phase: 'old' },
            { feature: 'ring', phase: 'young' },
            { feature: 'ring', phase: 'old' },
          ],
        }),
      },
    });

    const rows = [...container.querySelectorAll('app-list-row.trait')];
    expect(rows[3]?.querySelector('.row__title')?.textContent).toBe('Stielmerkmale');
    expect(rows[3]?.querySelector('.row__sub')?.textContent).toBe('Ring, hohl (alt)');
    expect(rows[2]?.querySelector('.row__sub')?.getAttribute('lang')).toBe('de');
    expect(rows[3]?.querySelector('.row__sub')?.getAttribute('lang')).toBeNull();
    expect(screen.queryByText('Beschreibungen nur auf Deutsch')).toBeNull();
  });

  it('sagt auf Englisch, dass die Sätze nur auf Deutsch vorliegen', async () => {
    const { fixture } = await render(SpeciesTraitsComponent, {
      inputs: { species: speciesEntry({ ...STONE, stemFeatures: [{ feature: 'netted', phase: 'old' }] }) },
    });
    const i18n = TestBed.inject(I18nService);
    i18n.setLocale('en');
    await vi.waitFor(() => {
      expect(i18n.locale()).toBe('en');
    });
    fixture.detectChanges();

    expect(screen.getByText('Descriptions only in German')).toBeInTheDocument();
    expect(screen.getByText('Net (old)')).toBeInTheDocument();
    i18n.setLocale('de');
  });
});
