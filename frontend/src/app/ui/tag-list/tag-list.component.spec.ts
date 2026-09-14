import { render, screen } from '@testing-library/angular';
import { noViolations } from '../../testing/axe';
import { EMPTY_CATALOG, noGermanText } from '../../testing/i18n';
import { TagListComponent } from './tag-list.component';

describe('TagListComponent', () => {
  it('stellt jede Kategorie als eigenen Eintrag', async () => {
    const { container } = await render(TagListComponent, {
      inputs: { tags: ['pilzig', 'nussig'], label: 'Geruch' },
    });

    expect(screen.getByRole('list', { name: 'Geruch' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('nussig')).toBeInTheDocument();
    await noViolations(container);
  });

  it('bleibt ohne Kategorie leer', async () => {
    await render(TagListComponent, { inputs: { tags: [], label: 'Geschmack' } });

    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
  });

  it('bleibt ohne deutsches Wort im leeren Katalog', async () => {
    const { container } = await render(TagListComponent, {
      providers: [EMPTY_CATALOG],
      inputs: { tags: ['nutty', 'earthy'], label: 'Smell' },
    });

    noGermanText(container);
  });
});
