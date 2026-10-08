import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import type { EntriesFilter } from './entry-filter';
import { ZONE } from '../../testing/entries-fixture';
import { FAMILY, KARLSRUHE } from '../../testing/groups-fixture';
import { EntriesFilterBodyComponent } from './entries-filter-body.component';
import { NO_FILTER } from './entry-filter';

const FULL: EntriesFilter = {
  visibility: 'shared',
  groupId: FAMILY.id,
  zoneId: ZONE.id,
  time: 'week',
  withPhoto: false,
};

async function build(filter: EntriesFilter, lists = true) {
  const changes: EntriesFilter[] = [];
  await render(EntriesFilterBodyComponent, {
    inputs: {
      filter,
      today: '2026-09-06',
      groups: lists ? [KARLSRUHE, FAMILY] : [],
      zones: lists ? [ZONE] : [],
    },
    on: { filterChange: (value: EntriesFilter) => changes.push(value) },
  });
  return changes;
}

const chip = (group: string, name: string): HTMLElement =>
  within(screen.getByRole('group', { name: group })).getByRole('button', { name });

describe('EntriesFilterBodyComponent', () => {
  it('names the time chips after the day and hides empty group and zone lists', async () => {
    await build(NO_FILTER, false);

    const times = within(screen.getByRole('group', { name: 'Zeit' })).getAllByRole('button');
    expect(times.map((one) => one.textContent.trim())).toEqual(['Heute', 'Diese Woche', 'September', '2026']);
    expect(screen.queryByRole('group', { name: 'Gruppe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Zone' })).not.toBeInTheDocument();
  });

  it('sets each single choice', async () => {
    const changes = await build(NO_FILTER);

    await userEvent.click(chip('Sichtbarkeit', 'privat'));
    await userEvent.click(chip('Gruppe', KARLSRUHE.name));
    await userEvent.click(chip('Zone', ZONE.name));
    await userEvent.click(chip('Zeit', '2026'));
    await userEvent.click(screen.getByRole('switch', { name: 'nur mit Foto' }));

    expect(changes).toEqual([
      { ...NO_FILTER, visibility: 'private' },
      { ...NO_FILTER, groupId: KARLSRUHE.id },
      { ...NO_FILTER, zoneId: ZONE.id },
      { ...NO_FILTER, time: 'year' },
      { ...NO_FILTER, withPhoto: true },
    ]);
  });

  it('clears a choice when its chip is pressed again', async () => {
    const changes = await build(FULL);

    await userEvent.click(chip('Sichtbarkeit', 'geteilt'));
    await userEvent.click(chip('Gruppe', FAMILY.name));
    await userEvent.click(chip('Zone', ZONE.name));
    await userEvent.click(chip('Zeit', 'Diese Woche'));

    expect(changes).toEqual([
      { ...FULL, visibility: null },
      { ...FULL, groupId: null },
      { ...FULL, zoneId: null },
      { ...FULL, time: null },
    ]);
  });
});
