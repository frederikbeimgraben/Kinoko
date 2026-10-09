import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ANY_ROUTE } from '../../testing/routes';
import { MethodComponent } from './method.component';

describe('MethodComponent', () => {
  it('zeigt die Zeilen der Methode und führt zurück zum Konto', async () => {
    await render(MethodComponent, { providers: [provideRouter(ANY_ROUTE)] });
    const router = TestBed.inject(Router);
    const change = vi.spyOn(router, 'navigateByUrl');

    expect(screen.getByText('Begehungen')).toBeInTheDocument();
    expect(screen.getByText('isotonisch, Obergrenze 0,50')).toBeInTheDocument();
    expect(screen.getByText('Aktualisierung')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(change).toHaveBeenCalledWith('/konto');
  });
});
