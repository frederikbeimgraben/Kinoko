import type { Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { flatMap } from '../fixtures/flat-map';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { GROUPS, ME, OTHER_ME } from '../fixtures/groups';
import { expect, test } from '../fixtures/test';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** A board belongs to one device and does not run while it is pending. */
function guard(board: string, device: 'phone' | 'wide'): void {
  test.skip(test.info().project.name !== device, `board belongs to ${device}`);
  skipPending(board);
}

/** The group of the board `GroupPage`: its code and the days the members joined. */
const BOARD_GROUP = {
  ...GROUPS[0],
  inviteCode: 'KA-7F3Q-92',
  members: GROUPS[0].members.map((member) =>
    member.name === 'Marie' ? { ...member, joinedAt: '2026-09-09T08:00:00Z' } : member,
  ),
};

/** The three terms of the board `Glossary`. */
const BOARD_GLOSSARY = [
  ['begriff-eins', 'Hymenium', 'Fruchtschicht, in der die Sporen entstehen.'],
  ['begriff-zwei', 'Mykorrhiza', 'Lebensgemeinschaft von Pilz und Baumwurzel.'],
  ['begriff-drei', 'Velum', 'Hülle junger Fruchtkörper, bleibt als Ring oder Flocken.'],
].map(([id, term, definition]) => ({
  id,
  term,
  definition,
  updatedByName: 'Frederik',
  updatedAt: '2026-09-12T10:00:00Z',
}));

/** Signs in and opens a path of the groups. */
async function open(page: Page, path: string, me: unknown = ME): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/me': me,
    '/api/groups': { items: [BOARD_GROUP, GROUPS[1]] },
    '/api/glossary': { items: BOARD_GLOSSARY },
    '/api/combinations': { items: [], nextCursor: null },
  });
  await flatMap(page);
  await page.goto(path);
}

test('Groups', async ({ page }) => {
  guard('Groups', 'phone');
  await open(page, '/konto/gruppen');
  await expect(page.getByText('3 Mitglieder · Eigentümer')).toBeVisible();
  await expectBoard(page, 'Groups');
});

test('GroupCreate', async ({ page }) => {
  guard('GroupCreate', 'phone');
  await open(page, '/konto/gruppen');
  await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
  await expect(page.getByRole('button', { name: 'Anlegen', exact: true })).toBeVisible();
  await expectBoard(page, 'GroupCreate');
});

test('GroupJoin', async ({ page }) => {
  guard('GroupJoin', 'phone');
  await open(page, '/konto/gruppen');
  await page.getByRole('button', { name: 'Gruppe beitreten' }).click();
  await expect(page.getByRole('button', { name: 'Beitreten', exact: true })).toBeVisible();
  await expectBoard(page, 'GroupJoin');
});

test('GroupPage', async ({ page }) => {
  guard('GroupPage', 'phone');
  await open(page, `/konto/gruppen/${GROUPS[0].id}`);
  await expect(page.getByText('KA-7F3Q-92')).toBeVisible();
  await expectBoard(page, 'GroupPage');
});

test('Glossary', async ({ page }) => {
  guard('Glossary', 'phone');
  await open(page, '/konto/glossar');
  await expect(page.getByText('Mykorrhiza')).toBeVisible();
  await expectBoard(page, 'Glossary');
});

test('GroupMember', async ({ page }) => {
  guard('GroupMember', 'phone');
  await open(page, `/konto/gruppen/${GROUPS[0].id}`, OTHER_ME);
  await expect(page.getByRole('button', { name: 'Verlassen' })).toBeVisible();
});

test('AccountDesktopGroups', async ({ page }) => {
  guard('AccountDesktopGroups', 'wide');
  await open(page, '/konto/gruppen');
  await expect(page.getByText('3 Mitglieder · Eigentümer')).toBeVisible();
  await expectBoard(page, 'AccountDesktopGroups');
});

test('AccountDesktopGroupPage', async ({ page }) => {
  guard('AccountDesktopGroupPage', 'wide');
  await open(page, `/konto/gruppen/${GROUPS[0].id}`);
  await expect(page.getByText('KA-7F3Q-92')).toBeVisible();
  await expectBoard(page, 'AccountDesktopGroupPage');
});

test('AccountDesktopGroupCreate', async ({ page }) => {
  guard('AccountDesktopGroupCreate', 'wide');
  await open(page, '/konto/gruppen');
  await page.getByRole('button', { name: 'Gruppe anlegen' }).click();
  await expect(page.getByRole('button', { name: 'Anlegen', exact: true })).toBeVisible();
  await expectBoard(page, 'AccountDesktopGroupCreate');
});

test('AccountDesktopGroupJoin', async ({ page }) => {
  guard('AccountDesktopGroupJoin', 'wide');
  await open(page, '/konto/gruppen');
  await page.getByRole('button', { name: 'Gruppe beitreten' }).click();
  await expect(page.getByRole('button', { name: 'Beitreten', exact: true })).toBeVisible();
  await expectBoard(page, 'AccountDesktopGroupJoin');
});

test('AccountDesktopGlossary', async ({ page }) => {
  guard('AccountDesktopGlossary', 'wide');
  await open(page, '/konto/glossar');
  await expect(page.getByText('Mykorrhiza')).toBeVisible();
  await expectBoard(page, 'AccountDesktopGlossary');
});
