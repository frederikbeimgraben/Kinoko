import { Router, provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { ANY_ROUTE } from '../../testing/routes';
import { LicencesComponent } from './licences.component';

describe('LicencesComponent', () => {
  it('nennt jede Quelle mit ihrer Lizenz und führt zurück zum Konto', async () => {
    await render(LicencesComponent, { providers: [provideRouter(ANY_ROUTE)] });
    const router = TestBed.inject(Router);
    const change = vi.spyOn(router, 'navigateByUrl');

    expect(screen.getByText('Kartendaten')).toBeInTheDocument();
    expect(screen.getByText('123pilzsuche.de')).toBeInTheDocument();
    expect(screen.getByText('CC BY 4.0, CC BY-SA 4.0, eigene')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zurück' }));

    expect(change).toHaveBeenCalledWith('/konto');
  });
});
