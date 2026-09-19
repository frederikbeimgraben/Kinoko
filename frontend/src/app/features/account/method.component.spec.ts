import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ANY_ROUTE } from '../../testing/routes';
import { MethodComponent } from './method.component';

describe('MethodComponent', () => {
  it('zeigt die Absätze der Methode und führt zurück zum Konto', async () => {
    await render(MethodComponent, { providers: [provideRouter(ANY_ROUTE)] });
    const router = TestBed.inject(Router);
    const change = vi.spyOn(router, 'navigateByUrl');

    expect(screen.getByText('Was die Karte zeigt')).toBeInTheDocument();
    expect(screen.getByText('Was die Karte nicht zeigt')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(change).toHaveBeenCalledWith('/konto');
  });
});
