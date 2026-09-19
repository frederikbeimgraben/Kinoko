/** Die Gruppen der Bretter Groups, Group, GroupMember und der Verwaltung. */

const FREDERIK = '11111111-1111-1111-1111-111111111111';
const JONAS = '22222222-2222-2222-2222-222222222222';
const MARIE = '33333333-3333-3333-3333-333333333333';
const LENA = '55555555-5555-5555-5555-555555555555';

/** Das eigene Konto: Eigentümer der Pilzgruppe Karlsruhe. */
export const ME = { id: FREDERIK, sub: 'sub-eins', name: 'Frederik', email: 'frederik@beimgraben.net' };

/** Dasselbe Konto als Mitglied, nicht als Eigentümer. */
export const OTHER_ME = { ...ME, id: MARIE };

export const GROUPS = [
  {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Pilzgruppe Karlsruhe',
    ownerId: FREDERIK,
    inviteCode: 'PILZ-7F3K',
    createdAt: '2026-09-03T08:00:00Z',
    members: [
      { userId: FREDERIK, name: 'Frederik', joinedAt: '2026-09-03T08:00:00Z' },
      { userId: JONAS, name: 'Jonas', joinedAt: '2026-09-05T08:00:00Z' },
      { userId: MARIE, name: 'Marie', joinedAt: '2026-09-12T08:00:00Z' },
    ],
  },
  {
    id: '66666666-6666-6666-6666-666666666666',
    name: 'Familie',
    ownerId: MARIE,
    inviteCode: 'PILZ-2QX8',
    createdAt: '2026-09-04T08:00:00Z',
    members: [
      { userId: MARIE, name: 'Marie', joinedAt: '2026-09-04T08:00:00Z' },
      { userId: FREDERIK, name: 'Frederik', joinedAt: '2026-09-06T08:00:00Z' },
      { userId: JONAS, name: 'Jonas', joinedAt: '2026-09-08T08:00:00Z' },
      { userId: LENA, name: 'Lena', joinedAt: '2026-09-10T08:00:00Z' },
    ],
  },
];
