import { render, screen } from '@testing-library/angular';
import { FormSheetComponent } from './form-sheet.component';

describe('FormSheetComponent', () => {
  it('zeigt Entfernen als gefüllte rote Taste neben Speichern, wie die Tafel AdminGlossaryEdit', async () => {
    await render(FormSheetComponent, {
      inputs: { title: 'Glossareintrag', submit: 'Speichern', secondary: 'Entfernen', secondaryDanger: true },
    });

    expect(await screen.findByRole('button', { name: 'Entfernen' })).toHaveClass('danger');
    expect(screen.getByRole('button', { name: 'Speichern' })).toHaveClass('primary');
  });

  it('zeigt ohne zweite Aktion nur die Hauptaktion', async () => {
    await render(FormSheetComponent, { inputs: { title: 'Gruppe', submit: 'Anlegen' } });

    expect(await screen.findByRole('button', { name: 'Anlegen' })).toHaveClass('primary');
    expect(screen.getAllByRole('button').filter((one) => one.classList.contains('danger'))).toEqual([]);
  });
});
