import { Component } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { LookalikeRowComponent } from './lookalike-row.component';

@Component({
  imports: [LookalikeRowComponent],
  template: `
    <app-lookalike-row
      name="Ölbaumtrichterling"
      latin="Omphalotus olearius"
      route="/arten/oelbaumtrichterling"
      compareRoute="/arten/pfifferling/vergleich/oelbaumtrichterling"
    >
      <span>Giftig</span>
    </app-lookalike-row>
    <app-lookalike-row name="Sommersteinpilz" />
  `,
})
class HostComponent {}

/** Die gerechneten Stile eines Elements, das es geben muss. */
function styleOf(element: Element | null): CSSStyleDeclaration {
  if (element === null) throw new Error('Das Element steht nicht im Baum.');
  return getComputedStyle(element);
}

describe('LookalikeRowComponent', () => {
  it('zeigt Name, lateinischen Namen und Marke', async () => {
    const { container } = await render(HostComponent, { providers: [provideRouter([])] });

    expect(screen.getByText('Ölbaumtrichterling')).toBeInTheDocument();
    expect(screen.getByText('Omphalotus olearius')).toBeInTheDocument();
    expect(screen.getByText('Giftig')).toBeInTheDocument();
    await noViolations(container);
  });

  it('führt über zwei Zeichen zum Vergleich und zur Artseite', async () => {
    await render(HostComponent, { providers: [provideRouter([])] });

    expect(screen.getByRole('link', { name: 'Ölbaumtrichterling gegenüberstellen' })).toHaveAttribute(
      'href',
      '/arten/pfifferling/vergleich/oelbaumtrichterling',
    );
    expect(screen.getByRole('link', { name: 'Ölbaumtrichterling ansehen' })).toHaveAttribute(
      'href',
      '/arten/oelbaumtrichterling',
    );
  });

  it('lässt beide Zeichen weg, wo es kein Ziel gibt', async () => {
    await render(HostComponent, { providers: [provideRouter([])] });

    expect(screen.queryByRole('link', { name: /Sommersteinpilz/ })).not.toBeInTheDocument();
    expect(screen.getByText('Sommersteinpilz')).toBeInTheDocument();
  });

  it('stellt die Marke unter den Text, nicht in den Fluss', async () => {
    const { container } = await render(HostComponent, { providers: [provideRouter([])] });

    // Im Textfluss sprang die Marke je nach Länge in dieselbe oder die nächste
    // Zeile, und der Abstand darüber wechselte von Zeile zu Zeile.
    const text = styleOf(container.querySelector('.lookalike__text'));
    expect(text.flexDirection).toBe('column');
    expect(styleOf(container.querySelector('.lookalike__badge')).marginBlockStart).toBe('var(--space-2)');
  });

  it('stapelt Name und lateinischen Namen in einer Spur', async () => {
    const { container } = await render(HostComponent, { providers: [provideRouter([])] });

    // Der Grund für den Bruch nach PR 78: Name und lateinischer Name standen in
    // zwei Rasterspuren, und der Wertspur blieb so wenig, dass „Leccinum
    // melaneum“ Buchstabe für Buchstabe umbrach. Beide Namen gehören zu einer
    // Art, also stehen sie in einer Spur.
    const row = container.querySelector('app-lookalike-row');
    const tracks = [...(row?.children ?? [])].map((child) => child.className);
    expect(tracks).toEqual(['lookalike__text', 'lookalike__actions']);

    const stack = container.querySelector('.lookalike__text');
    expect(stack?.querySelector('.lookalike__name')).not.toBeNull();
    expect(stack?.querySelector('.lookalike__latin')).not.toBeNull();
  });

  it('lässt einen langen lateinischen Namen nicht Buchstabe für Buchstabe brechen', async () => {
    // jsdom rechnet kein Layout, eine Höhe ist hier also nicht zu messen. Was
    // sich prüfen lässt, ist die Ursache: der Name steht in einer Spur, die
    // schrumpfen darf, und bricht an Wortgrenzen, nicht an jedem Zeichen.
    const { container } = await render(HostComponent, { providers: [provideRouter([])] });

    const stack = styleOf(container.querySelector('.lookalike__text'));
    expect(stack.minInlineSize).toBe('0px');
    expect(stack.overflowWrap).toBe('anywhere');
    expect(styleOf(container.querySelector('app-lookalike-row')).gridTemplateColumns).toBe(
      'minmax(0, 1fr) auto',
    );
  });
});
