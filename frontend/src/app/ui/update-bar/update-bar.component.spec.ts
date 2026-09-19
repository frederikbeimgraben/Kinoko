import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { PwaService } from '../../core/pwa/pwa.service';
import { UpdateBarComponent } from './update-bar.component';

/** `PwaService` mit steuerbarem Bereitschaftszustand. */
function pwaDouble(ready: boolean): { updateReady: () => boolean; activate: () => Promise<void> } {
  return { updateReady: signal(ready), activate: vi.fn().mockResolvedValue(undefined) };
}

describe('UpdateBarComponent', () => {
  it('zeigt nichts, solange keine Fassung bereitsteht', async () => {
    await render(UpdateBarComponent, {
      providers: [{ provide: PwaService, useValue: pwaDouble(false) }],
    });

    expect(screen.queryByRole('status')).toBeNull();
  });

  it('zeigt die Leiste mit Text und Knopf, sobald eine Fassung bereitsteht', async () => {
    await render(UpdateBarComponent, {
      providers: [{ provide: PwaService, useValue: pwaDouble(true) }],
    });

    expect(screen.getByRole('status')).toHaveTextContent('Neue Version');
    expect(screen.getByRole('button', { name: 'Neu laden' })).toBeInTheDocument();
  });

  it('aktiviert die Fassung, sobald die Person den Knopf drückt', async () => {
    const pwa = pwaDouble(true);
    await render(UpdateBarComponent, { providers: [{ provide: PwaService, useValue: pwa }] });

    await userEvent.click(screen.getByRole('button', { name: 'Neu laden' }));

    expect(pwa.activate).toHaveBeenCalledOnce();
  });
});
