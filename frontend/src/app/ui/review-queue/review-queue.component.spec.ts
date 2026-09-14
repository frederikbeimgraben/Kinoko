import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { ReviewQueueComponent } from './review-queue.component';

@Component({
  imports: [ReviewQueueComponent],
  template: `
    <app-review-queue
      [items]="items"
      (accepted)="onAccepted($event)"
      (rejected)="onRejected($event)"
      (undone)="onUndone($event)"
    >
      <ng-template let-item>
        <p>{{ item }}</p>
      </ng-template>
    </app-review-queue>
  `,
})
class HostComponent {
  readonly items = ['Pfifferling', 'Steinpilz', 'Perlpilz'];
  readonly acceptedCalls: string[] = [];
  readonly rejectedCalls: string[] = [];
  readonly undoneCalls: string[] = [];

  onAccepted(item: string): void {
    this.acceptedCalls.push(item);
  }

  onRejected(item: string): void {
    this.rejectedCalls.push(item);
  }

  onUndone(item: string): void {
    this.undoneCalls.push(item);
  }
}

@Component({
  imports: [ReviewQueueComponent],
  template: `
    <app-review-queue [items]="items">
      <ng-template let-item>
        <p>{{ item }}</p>
      </ng-template>
    </app-review-queue>
  `,
})
class AsciiHostComponent {
  readonly items = ['first', 'second'];
}

function swipe(card: Element, from: number, to: number): void {
  card.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: from }));
  card.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: to }));
  card.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: to }));
}

function topCard(container: HTMLElement): HTMLElement {
  const card = container.querySelector('.queue__card--top');
  if (!(card instanceof HTMLElement)) throw new Error('keine Karte im Baum');
  return card;
}

describe('ReviewQueueComponent', () => {
  it('zeigt die erste Karte und den Zähler im Kopf', async () => {
    const { container } = await render(HostComponent);

    expect(screen.getByText('Pfifferling')).toBeInTheDocument();
    expect(screen.getByText('0 von 3')).toBeInTheDocument();
    await noViolations(container);
  });

  it('nimmt über den Haken-Knopf an und zählt weiter', async () => {
    const { container, fixture } = await render(HostComponent);

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));

    expect(fixture.componentInstance.acceptedCalls).toEqual(['Pfifferling']);
    expect(screen.getByText('1 von 3')).toBeInTheDocument();
    expect(screen.getByText('Steinpilz')).toBeInTheDocument();
    expect(container.querySelector('.queue__round--undo')).not.toBeDisabled();
  });

  it('lehnt über den X-Knopf ab', async () => {
    const { fixture } = await render(HostComponent);

    await userEvent.click(screen.getByRole('button', { name: 'Ablehnen' }));

    expect(fixture.componentInstance.rejectedCalls).toEqual(['Pfifferling']);
  });

  it('macht die letzte Entscheidung über Rückgängig rückgängig', async () => {
    const { fixture } = await render(HostComponent);
    const undo = screen.getByRole('button', { name: 'Rückgängig' });
    expect(undo).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    await userEvent.click(undo);

    expect(fixture.componentInstance.undoneCalls).toEqual(['Pfifferling']);
    expect(screen.getByText('0 von 3')).toBeInTheDocument();
    expect(screen.getByText('Pfifferling')).toBeInTheDocument();
  });

  it('nimmt mit der Pfeiltaste rechts an, lehnt mit links ab, macht mit Rücktaste rückgängig', async () => {
    const { fixture, container } = await render(HostComponent);
    const card = topCard(container);
    expect(card).toHaveAttribute('role', 'group');
    card.focus();

    await userEvent.keyboard('{ArrowRight}');
    await userEvent.keyboard('{ArrowLeft}');
    await userEvent.keyboard('{Backspace}');

    expect(fixture.componentInstance.acceptedCalls).toEqual(['Pfifferling']);
    expect(fixture.componentInstance.rejectedCalls).toEqual(['Steinpilz']);
    expect(fixture.componentInstance.undoneCalls).toEqual(['Steinpilz']);
  });

  it('nimmt an, wenn über die Schwelle nach rechts gewischt wird', async () => {
    const { fixture, container } = await render(HostComponent);
    const card = topCard(container);

    swipe(card, 0, 200);

    expect(fixture.componentInstance.acceptedCalls).toEqual(['Pfifferling']);
  });

  it('lehnt ab, wenn über die Schwelle nach links gewischt wird', async () => {
    const { fixture, container } = await render(HostComponent);
    const card = topCard(container);

    swipe(card, 0, -200);

    expect(fixture.componentInstance.rejectedCalls).toEqual(['Pfifferling']);
  });

  it('federt ohne Entscheidung zurück, wenn der Zug unter der Schwelle bleibt', async () => {
    const { fixture, container } = await render(HostComponent);
    const card = topCard(container);

    swipe(card, 0, 20);

    expect(fixture.componentInstance.acceptedCalls).toEqual([]);
    expect(fixture.componentInstance.rejectedCalls).toEqual([]);
    expect(card.style.transform).toBe('translateX(0px) rotate(0deg)');
  });

  it('zeigt keine Karte mehr, wenn alle entschieden sind', async () => {
    const { fixture, container } = await render(HostComponent);

    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));
    await userEvent.click(screen.getByRole('button', { name: 'Freigeben' }));

    expect(fixture.componentInstance.acceptedCalls).toHaveLength(3);
    expect(screen.getByText('3 von 3')).toBeInTheDocument();
    expect(container.querySelector('.queue__card--top')).toBeNull();
  });

  it('trägt den Druckzustand an jedem runden Knopf', async () => {
    const { container } = await render(HostComponent);

    for (const round of container.querySelectorAll('.queue__round')) {
      expect(round).toHaveClass('tap');
      expect(round).toHaveAttribute('data-press', 'scale');
    }
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(AsciiHostComponent, { providers: [EMPTY_CATALOG] });

    noGermanText(container);
  });
});
