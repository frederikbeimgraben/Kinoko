import { Component } from '@angular/core';
import type { ComponentFixture } from '@angular/core/testing';
import { render } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { SplitLayoutComponent } from './split-layout.component';

@Component({
  imports: [SplitLayoutComponent],
  template: `<app-split-layout kind="column"><p>Inhalt</p></app-split-layout>`,
})
class HostComponent {}

/** Liefert den Wirt der Aufteilung, den die Klassen tragen. */
function host(view: { fixture: ComponentFixture<SplitLayoutComponent> }): HTMLElement {
  return view.fixture.componentRef.location.nativeElement as HTMLElement;
}

describe('SplitLayoutComponent', () => {
  it('trägt seinen Inhalt', async () => {
    const { container } = await render(HostComponent);

    expect(container.querySelector('.layout__in')).toHaveTextContent('Inhalt');
    await noViolations(container);
  });

  it('nimmt als Spalte den Rest der Breite', async () => {
    const view = await render(SplitLayoutComponent, { inputs: { kind: 'column' } });

    expect(host(view)).toHaveClass('layout--column');
    expect(host(view)).not.toHaveClass('layout--fixed');
  });

  it('hält eine feste Breite', async () => {
    const view = await render(SplitLayoutComponent, {
      inputs: { kind: 'column', width: 272 },
    });

    expect(host(view).style.inlineSize).toBe('272px');
    expect(host(view)).toHaveClass('layout--fixed');
  });

  it('nimmt die feste Breite der Rechner-Spalte aus dem Entwurf', async () => {
    const view = await render(SplitLayoutComponent, {
      inputs: { kind: 'pane', pane: 'panel' },
    });

    expect(host(view)).toHaveClass('layout--panel');
    expect(host(view).style.inlineSize).toBe('420px');
  });

  it('lässt die Detail-Spalte den Rest nehmen', async () => {
    const view = await render(SplitLayoutComponent, {
      inputs: { kind: 'pane', pane: 'detail' },
    });

    expect(host(view).style.inlineSize).toBe('');
    expect(host(view)).not.toHaveClass('layout--fixed');
  });

  it('setzt das Raster aus der Zahl der Spalten', async () => {
    const view = await render(SplitLayoutComponent, {
      inputs: { kind: 'columns', cols: 3 },
    });

    const box = view.container.querySelector<HTMLElement>('.layout__in');
    expect(box?.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
  });

  it('nimmt den Innenabstand der Teilung aus dem Entwurf', async () => {
    const view = await render(SplitLayoutComponent, { inputs: { kind: 'split' } });

    const box = view.container.querySelector<HTMLElement>('.layout__in');
    expect(box?.style.padding).toBe('0px 8px 0px 16px');
  });

  it('nimmt einen eigenen Innenabstand', async () => {
    const view = await render(SplitLayoutComponent, {
      inputs: { kind: 'column', pad: '8px' },
    });

    expect(view.container.querySelector<HTMLElement>('.layout__in')?.style.padding).toBe('8px');
  });

  it('stellt die mittlere Spalte auf ihre eigene Fläche', async () => {
    const view = await render(SplitLayoutComponent, {
      inputs: { kind: 'pane', pane: 'map', ground: 'mid' },
    });

    expect(host(view)).toHaveClass('layout--mid');
  });
});
