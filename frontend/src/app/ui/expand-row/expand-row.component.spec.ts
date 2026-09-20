import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { ExpandRowComponent } from './expand-row.component';

@Component({
  imports: [ExpandRowComponent],
  template: `
    <app-expand-row label="Hut" value="Braun" dot="#7a4a2a" [open]="open">
      <p>Inhalt</p>
    </app-expand-row>
  `,
})
class HostComponent {
  open = true;
}

describe('ExpandRowComponent', () => {
  it('zeigt Beschriftung und Wert im Kopf', async () => {
    const { container } = await render(ExpandRowComponent, {
      inputs: { label: 'Hut', value: 'Braun' },
    });

    expect(screen.getByText('Hut')).toBeInTheDocument();
    expect(screen.getByText('Braun')).toBeInTheDocument();
    await noViolations(container);
  });

  it('zeigt den Inhalt, solange die Zeile offen ist', async () => {
    await render(HostComponent);

    expect(screen.getByText('Inhalt')).toBeInTheDocument();
  });

  it('verbirgt den Inhalt, solange die Zeile zu ist', async () => {
    const { container } = await render(ExpandRowComponent, {
      inputs: { label: 'Hut', open: false },
    });

    expect(container.querySelector('.xp__body')).toBeNull();
  });

  it('klappt über den Kopf auf und zu', async () => {
    const { fixture } = await render(ExpandRowComponent, { inputs: { label: 'Hut', open: false } });

    await userEvent.click(screen.getByRole('button', { name: /Hut/ }));

    expect(fixture.componentInstance.open()).toBe(true);
  });

  it('meldet aria-expanded am Kopf', async () => {
    await render(ExpandRowComponent, { inputs: { label: 'Hut', open: false } });

    expect(screen.getByRole('button', { name: /Hut/ })).toHaveAttribute('aria-expanded', 'false');
  });

  it('zeigt einen Farbpunkt, wenn Wert und Farbe gesetzt sind', async () => {
    const { container } = await render(ExpandRowComponent, {
      inputs: { label: 'Hut', value: 'Braun', dot: '#7a4a2a' },
    });

    const dot = container.querySelector<HTMLElement>('.dot');
    expect(dot?.style.background).toBe('rgb(122, 74, 42)');
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(ExpandRowComponent, {
      inputs: { label: 'Cap', value: 'Brown' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
