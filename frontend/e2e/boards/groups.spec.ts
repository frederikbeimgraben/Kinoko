import type { Page } from '@playwright/test';
import { mockApi } from '../fixtures/api';
import { authConfig, mockSignIn } from '../fixtures/auth';
import { GLOSSARY } from '../fixtures/glossary';
import { GROUPS, ME, OTHER_ME } from '../fixtures/groups';
import { expect, test } from '../fixtures/test';
import { expectBoard, skipPending } from './board';

const BASE = `http://127.0.0.1:${process.env['E2E_PORT'] ?? '4400'}`;

/** Ein Brett gehört zu einem Gerät und läuft nicht, solange es aussteht. */
function guard(board: string, device: 'phone' | 'desktop'): void {
  test.skip(test.info().project.name !== device, `Brett gehört zu ${device}`);
  skipPending(board);
}

/** Meldet an und öffnet einen Weg der Gruppen. */
async function open(page: Page, path: string, me: unknown = ME): Promise<void> {
  await mockSignIn(page);
  await mockApi(page, {
    '/api/config': authConfig(BASE),
    '/api/me': me,
    '/api/groups': { items: GROUPS },
    '/api/glossary': { items: GLOSSARY },
  });
  await page.goto(path);
}

test('Groups', async ({ page }) => {
  guard('Groups', 'phone');
  await open(page, '/konto/gruppen');
  await expect(page.getByText('Pilzgruppe Karlsruhe')).toBeVisible();
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
  await page.getByRole('button', { name: 'Code eingeben' }).click();
  await expect(page.getByRole('button', { name: 'Beitreten', exact: true })).toBeVisible();
  await expectBoard(page, 'GroupJoin');
});

test('GroupPage', async ({ page }) => {
  guard('GroupPage', 'phone');
  await open(page, `/konto/gruppen/${GROUPS[0].id}`);
  await expect(page.getByText('PILZ-7F3K')).toBeVisible();
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
