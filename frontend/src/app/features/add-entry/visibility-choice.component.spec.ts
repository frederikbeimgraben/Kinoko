import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { GroupsApiDouble, KARLSRUHE, groupsApiProvider } from '../../testing/groups-fixture';
import { VisibilityChoiceComponent } from './visibility-choice.component';

interface Setup {
  api: GroupsApiDouble;
  visibilities: string[];
  groups: (string | null)[];
}

async function build(visibility: 'private' | 'shared', groupId: string | null = null): Promise<Setup> {
  const api = new GroupsApiDouble();
  const visibilities: string[] = [];
  const groups: (string | null)[] = [];
  await render(VisibilityChoiceComponent, {
    inputs: { visibility, groupId },
    on: {
      visibilityChange: (value: string) => visibilities.push(value),
      groupChange: (value: string | null) => groups.push(value),
    },
    providers: [groupsApiProvider(api)],
  });
  return { api, visibilities, groups };
}

describe('VisibilityChoiceComponent', () => {
  it('holt die Gruppen erst beim Teilen', async () => {
    const setup = await build('private');

    expect(setup.api.calls).toEqual([]);
    expect(screen.queryByText('Gruppe')).not.toBeInTheDocument();
  });

  it('zeigt die gewählte Gruppe und lässt eine andere wählen', async () => {
    const setup = await build('shared', KARLSRUHE.id);

    expect(setup.api.calls).toEqual([false]);
    expect(screen.getByText('Pilzgruppe Karlsruhe')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Pilzgruppe Karlsruhe' }));
    await userEvent.click(screen.getByRole('button', { name: 'Familie' }));

    expect(setup.groups.at(-1)).toBe('gruppe-zwei');
  });

  it('nimmt die einzige Gruppe von allein', async () => {
    const api = new GroupsApiDouble();
    api.groupList = [KARLSRUHE];
    const groups: (string | null)[] = [];
    await render(VisibilityChoiceComponent, {
      inputs: { visibility: 'shared', groupId: null },
      on: { groupChange: (value: string | null) => groups.push(value) },
      providers: [groupsApiProvider(api)],
    });

    expect(groups).toEqual([KARLSRUHE.id]);
  });

  it('nimmt beim Wechsel auf privat die Gruppe zurück', async () => {
    const setup = await build('shared', KARLSRUHE.id);

    await userEvent.click(screen.getByRole('tab', { name: 'Privat' }));

    expect(setup.visibilities).toEqual(['private']);
    expect(setup.groups.at(-1)).toBeNull();
  });

  it('meldet den Wechsel auf geteilt', async () => {
    const setup = await build('private');

    await userEvent.click(screen.getByRole('tab', { name: 'Geteilt' }));

    expect(setup.visibilities).toEqual(['shared']);
  });
});
