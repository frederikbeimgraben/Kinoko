import { Component, signal } from '@angular/core';
import { render, type RenderResult } from '@testing-library/angular';
import { ScrollFadeDirective } from './scroll-fade.directive';

@Component({
  imports: [ScrollFadeDirective],
  template: `
    @if (open()) {
      <div appScrollFade>
        @for (row of rows(); track row) {
          <p class="row"></p>
        }
      </div>
    }
  `,
})
class HostComponent {
  readonly open = signal(true);
  readonly rows = signal([1]);
}

/** Die Zeilen stecken in einer Karte, wie im Katalog: kein Kind des Wirts. */
@Component({
  imports: [ScrollFadeDirective],
  template: `
    <div appScrollFade>
      <div class="card">
        @for (row of rows(); track row) {
          <p class="row"></p>
        }
      </div>
    </div>
  `,
})
class CardHostComponent {
  readonly rows = signal([1, 2, 3]);
}

const box = { scrollTop: 0, clientHeight: 0, scrollHeight: 0 };

/** jsdom rechnet kein Layout; die Maße der Liste gibt der Test vor. */
function stubGeometry(): void {
  for (const name of ['scrollTop', 'clientHeight', 'scrollHeight'] as const) {
    vi.spyOn(Element.prototype, name, 'get').mockImplementation(() => box[name]);
  }
}

function fade(view: RenderResult<object>): string | null {
  return view.container.querySelector('.scroll')?.getAttribute('data-fade') ?? null;
}

async function list(scrollTop: number, clientHeight: number, scrollHeight: number) {
  Object.assign(box, { scrollTop, clientHeight, scrollHeight });
  stubGeometry();
  return render(HostComponent);
}

async function cardList(scrollTop: number, clientHeight: number, scrollHeight: number) {
  Object.assign(box, { scrollTop, clientHeight, scrollHeight });
  stubGeometry();
  return render(CardHostComponent);
}

/** Bewegt die Liste und lässt den Wirt auf das Ereignis antworten. */
function scrollTo(view: RenderResult<HostComponent>, scrollTop: number): void {
  box.scrollTop = scrollTop;
  view.container.querySelector('div')?.dispatchEvent(new Event('scroll'));
  view.detectChanges();
}

describe('ScrollFadeDirective', () => {
  it('blendet am Anfang nur unten aus', async () => {
    const view = await list(0, 100, 300);

    expect(fade(view)).toBe('bottom');
  });

  it('blendet in der Mitte oben und unten aus', async () => {
    const view = await list(0, 100, 300);

    scrollTo(view, 100);

    expect(fade(view)).toBe('both');
  });

  it('blendet am Ende nur oben aus', async () => {
    const view = await list(0, 100, 300);

    scrollTo(view, 200);

    expect(fade(view)).toBe('top');
  });

  it('blendet nichts aus, solange der Inhalt passt', async () => {
    const view = await list(0, 300, 300);

    scrollTo(view, 0);

    expect(fade(view)).toBe('none');
  });

  it('macht den Wirt zum Scroll-Bereich der Seite', async () => {
    const view = await list(0, 100, 300);

    expect(view.container.querySelector('.scroll')).not.toBeNull();
  });

  it('blendet unten aus, wenn eine Karte in der Liste überläuft', async () => {
    const view = await cardList(0, 100, 300);

    expect(fade(view)).toBe('bottom');
  });

  it('blendet unten wieder ein, sobald Zeilen in einer Karte wegfallen und der Rest passt', async () => {
    const view = await cardList(0, 100, 300);
    expect(fade(view)).toBe('bottom');

    box.scrollHeight = 100;
    view.fixture.componentInstance.rows.set([1]);
    view.detectChanges();
    await view.fixture.whenStable();

    expect(fade(view)).toBe('none');
  });
});
