import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { SectionComponent } from './section.component';

@Component({
  imports: [SectionComponent],
  template: `
    <app-section label="Einstufung">
      <p>Inhalt</p>
    </app-section>
  `,
})
class HostComponent {}

describe('SectionComponent', () => {
  it('zeigt die Beschriftung über seinem Inhalt', async () => {
    const { container } = await render(HostComponent);

    expect(screen.getByText('Einstufung')).toBeInTheDocument();
    const content = container.querySelector('.sec > p');
    expect(content).toHaveTextContent('Inhalt');
    await noViolations(container);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SectionComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { label: 'label' },
    });

    noGermanText(container);
  });
});
