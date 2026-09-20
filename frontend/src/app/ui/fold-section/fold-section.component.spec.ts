import { Component } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { FoldSectionComponent } from './fold-section.component';

@Component({
  imports: [FoldSectionComponent],
  template: `<app-fold-section label="Farbe" [(open)]="open"><p>Inhalt</p></app-fold-section>`,
})
class HostComponent {
  open = true;
}

describe('FoldSectionComponent', () => {
  it('zeigt den projizierten Inhalt offen', async () => {
    const { container } = await render(`<app-fold-section label="Farbe"><p>Inhalt</p></app-fold-section>`, {
      imports: [FoldSectionComponent],
    });

    expect(screen.getByText('Inhalt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Farbe' })).toHaveAttribute('aria-expanded', 'true');
    await noViolations(container);
  });

  it('blendet den Inhalt zu, wenn `open` aus ist', async () => {
    await render(`<app-fold-section label="Farbe" [open]="false"><p>Inhalt</p></app-fold-section>`, {
      imports: [FoldSectionComponent],
    });

    expect(screen.queryByText('Inhalt')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Farbe' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('klappt beim Antippen der Kopfzeile um, zweiseitig gebunden', async () => {
    await render(HostComponent);

    await userEvent.click(screen.getByRole('button', { name: 'Farbe' }));

    expect(screen.queryByText('Inhalt')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Farbe' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('setzt einen Kreis am Berührungspunkt der Kopfzeile', async () => {
    const { container } = await render(`<app-fold-section label="Farbe"><p>Inhalt</p></app-fold-section>`, {
      imports: [FoldSectionComponent],
    });

    const head = container.querySelector<HTMLElement>('.fold');
    if (head === null) throw new Error('keine Kopfzeile');

    vi.spyOn(head, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      width: 358,
      height: 20,
      right: 358,
      bottom: 20,
      toJSON: () => undefined,
    });
    head.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 10 }));

    expect(head.querySelector('.ripple')).not.toBeNull();
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(`<app-fold-section label="Colour"><p>Content</p></app-fold-section>`, {
      imports: [FoldSectionComponent],
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
