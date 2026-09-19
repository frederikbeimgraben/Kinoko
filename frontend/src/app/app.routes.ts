import type { Routes } from '@angular/router';
import { requiresPermission } from './features/admin/admin.guard';

/** Die vier Reiter. Wo das Arbeitspaket aussteht, steht ein Platzhalter. */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'karte' },
  {
    path: 'karte',
    loadComponent: () => import('./features/map/map-route.component').then((m) => m.MapRouteComponent),
  },
  {
    path: 'arten',
    loadComponent: () =>
      import('./features/species/species-list.component').then((m) => m.SpeciesListComponent),
  },
  {
    // Der Vergleich steht vor der Artseite: sonst nähme `:slug` das Wort.
    path: 'arten/vergleich',
    loadComponent: () =>
      import('./features/species/compare/comparison.component').then((m) => m.ComparisonComponent),
  },
  {
    path: 'arten/:slug',
    loadComponent: () =>
      import('./features/species/species-page.component').then((m) => m.SpeciesPageComponent),
  },
  {
    path: 'arten/:slug/bilder/neu',
    loadComponent: () => import('./features/images/image-form.component').then((m) => m.ImageFormComponent),
  },
  {
    path: 'arten/:slug/bilder/:id',
    loadComponent: () => import('./features/images/image-view.component').then((m) => m.ImageViewComponent),
  },
  {
    // Ein eigener Brocken: die Einordnung wird selten geöffnet und kostet im
    // ersten Bündel darum nichts.
    path: 'taxonomie/:rank/:slug',
    loadComponent: () => import('./features/taxonomy/taxonomy.component').then((m) => m.TaxonomyComponent),
  },
  {
    path: 'eintraege',
    loadComponent: () => import('./features/entries/entries.component').then((m) => m.EntriesComponent),
  },
  {
    path: 'konto',
    loadComponent: () => import('./features/account/account.component').then((m) => m.AccountComponent),
  },
  {
    path: 'konto/bilder',
    loadComponent: () => import('./features/account/my-images.component').then((m) => m.MyImagesComponent),
  },
  {
    path: 'verwaltung',
    canActivate: [requiresPermission(null)],
    loadComponent: () => import('./features/admin/admin.component').then((m) => m.AdminComponent),
    children: [
      {
        path: 'texte',
        canActivate: [requiresPermission('text.edit')],
        loadComponent: () => import('./features/admin/texts.component').then((m) => m.TextsComponent),
      },
      {
        path: 'rollen',
        canActivate: [requiresPermission('role.manage')],
        loadComponent: () => import('./features/admin/roles.component').then((m) => m.RolesComponent),
      },
      {
        path: 'rollen/:id',
        canActivate: [requiresPermission('role.manage')],
        loadComponent: () => import('./features/admin/role.component').then((m) => m.RoleComponent),
      },
      {
        path: 'bilder',
        canActivate: [requiresPermission('image.review')],
        loadComponent: () =>
          import('./features/images/image-queue.component').then((m) => m.ImageQueueComponent),
      },
      {
        path: 'personen',
        canActivate: [requiresPermission('role.assign')],
        loadComponent: () => import('./features/admin/people.component').then((m) => m.PeopleComponent),
      },
      {
        path: 'arten',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/admin-species.component').then((m) => m.AdminSpeciesComponent),
      },
      {
        path: 'laeufe',
        canActivate: [requiresPermission('run.manage')],
        loadComponent: () => import('./features/admin/runs.component').then((m) => m.RunsComponent),
      },
      {
        path: 'laeufe/:id',
        canActivate: [requiresPermission('run.manage')],
        loadComponent: () => import('./features/admin/run.component').then((m) => m.RunComponent),
      },
      {
        path: 'arten/neu',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/species-create.component').then((m) => m.SpeciesCreateComponent),
      },
      {
        path: 'arten/:slug',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/species-editor.component').then((m) => m.SpeciesEditorComponent),
      },
      {
        path: 'arten/:slug/mass/:part',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/section-size.component').then((m) => m.SectionSizeComponent),
      },
      {
        path: 'arten/:slug/teil/:part',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/section-part.component').then((m) => m.SectionPartComponent),
      },
      {
        path: 'arten/:slug/farbe/:part/:index',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/section-colour.component').then((m) => m.SectionColourComponent),
      },
      {
        path: 'arten/:slug/verfaerbung/:part/:index',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/section-colour-change.component').then(
            (m) => m.SectionColourChangeComponent,
          ),
      },
      {
        path: 'arten/:slug/verwechslung/:index',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/section-lookalike.component').then((m) => m.SectionLookalikeComponent),
      },
      {
        path: 'arten/:slug/zeitraum',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/section-season.component').then((m) => m.SectionSeasonComponent),
      },
      {
        path: 'arten/:slug/fruchtschicht',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/section-hymenium.component').then((m) => m.SectionHymeniumComponent),
      },
      {
        path: 'arten/:slug/sinne/:sense',
        canActivate: [requiresPermission('species.edit')],
        loadComponent: () =>
          import('./features/admin/section-senses.component').then((m) => m.SectionSensesComponent),
      },
    ],
  },
  // Die stille Route steht vor der Anmeldung: sonst nähme diese den ersten
  // Abschnitt und der Rest des Weges fände keine Route mehr.
  {
    path: 'anmeldung/still',
    loadComponent: () =>
      import('./features/account/silent-signin.component').then((m) => m.SilentSignInComponent),
  },
  {
    path: 'anmeldung',
    loadComponent: () =>
      import('./features/account/signin-callback.component').then((m) => m.SignInCallbackComponent),
  },
  {
    path: 'bausteine',
    loadComponent: () =>
      import('./dev/building-blocks/building-blocks.component').then((m) => m.BuildingBlocksComponent),
  },
  { path: '**', redirectTo: 'karte' },
];
