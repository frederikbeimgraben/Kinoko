import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { noViolations } from '../../testing/axe';
import { AccountTileComponent } from './account-tile.component';

describe('AccountTileComponent', () => {
  it('zeigt den Namen, die Mail und den Server', async () => {
    const { container } = await render(AccountTileComponent, {
      inputs: { user: 'Frederik', mail: 'frederik@beimgraben.net', server: 'sso.beimgraben.net' },
    });

    expect(screen.getByText('Frederik')).toBeInTheDocument();
    expect(screen.getByText('frederik@beimgraben.net')).toBeInTheDocument();
    expect(screen.getByText('sso.beimgraben.net')).toBeInTheDocument();
    await noViolations(container);
  });

  it('trägt den ersten Buchstaben im Kreis', async () => {
    await render(AccountTileComponent, {
      inputs: { user: 'Frederik', mail: 'a@b.c', server: 's' },
    });

    expect(screen.getByText('F')).toBeInTheDocument();
  });

  it('kürzt die Mail einzeilig mit Auslassung', async () => {
    const { container } = await render(AccountTileComponent, {
      inputs: { user: 'Frederik', mail: 'sehr.lange.adresse@ein-langer-anbieter.example', server: 's' },
    });

    const mail = container.querySelector('.acct__mail');
    const style = mail === null ? null : getComputedStyle(mail);
    expect(style?.whiteSpace).toBe('nowrap');
    expect(style?.textOverflow).toBe('ellipsis');
  });

  it('meldet die Abmeldung über den Symbolknopf', async () => {
    const { fixture } = await render(AccountTileComponent, {
      inputs: { user: 'Frederik', mail: 'a@b.c', server: 's' },
    });
    let calls = 0;
    fixture.componentInstance.signOut.subscribe(() => (calls += 1));

    await userEvent.click(screen.getByRole('button'));

    expect(calls).toBe(1);
  });

  it('bleibt ohne deutsches Wort bei leerem Katalog', async () => {
    const { container } = await render(AccountTileComponent, {
      inputs: { user: 'Frederik', mail: 'a@b.c', server: 's' },
      providers: [EMPTY_CATALOG],
    });

    noGermanText(container);
  });
});
