import { Component } from '@angular/core';
import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { SplitLayoutComponent } from './split-layout.component';

@Component({
  imports: [SplitLayoutComponent],
  template: `
    <app-split-layout>
      <nav split-rail>rail</nav>
      <section split-column>column</section>
      <article>content</article>
    </app-split-layout>
  `,
})
class HostComponent {}

describe('SplitLayoutComponent', () => {
  it('stellt Seitenleiste, Spalte und Inhalt in ihre eigenen Slots', async () => {
    const { container } = await render(HostComponent);

    const rail = container.querySelector('.layout__rail');
    const column = container.querySelector('.layout__column');
    const content = container.querySelector('.layout__content');

    expect(rail).toHaveTextContent('rail');
    expect(column).toHaveTextContent('column');
    expect(content).toHaveTextContent('content');
    await noViolations(container);
  });

  it('rendert ohne Inhalt in einem Slot', async () => {
    const { container } = await render(SplitLayoutComponent);

    expect(container.querySelector('.layout')).toBeInTheDocument();
    await noViolations(container);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(SplitLayoutComponent, { providers: [EMPTY_CATALOG] });

    noGermanText(container);
  });
});
