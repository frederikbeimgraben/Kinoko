import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { RowGroupComponent } from './row-group.component';

@Component({
  imports: [RowGroupComponent],
  template: `
    <app-row-group>
      <p>eins</p>
      <p>zwei</p>
    </app-row-group>
  `,
})
class HostComponent {}

describe('RowGroupComponent', () => {
  it('stellt seinen Inhalt in die Reihenfolge der Projektion', async () => {
    const { container } = await render(HostComponent);

    const rows = container.querySelectorAll('.grp > p');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('eins');
    expect(rows[1]).toHaveTextContent('zwei');
    await noViolations(container);
  });

  it('rendert leer ohne Inhalt', async () => {
    const { container } = await render(RowGroupComponent);

    expect(container.querySelector('.grp')).toBeInTheDocument();
    await noViolations(container);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(RowGroupComponent, { providers: [EMPTY_CATALOG] });

    noGermanText(container);
  });
});
