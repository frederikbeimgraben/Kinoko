import type { Routes } from '@angular/router';

/** The pixel test opens the card page at this path. Production has no route here. */
export const DEV_ROUTES: Routes = [
  {
    path: 'dev/blocks',
    loadComponent: () =>
      import('./building-blocks/building-blocks.component').then((m) => m.BuildingBlocksComponent),
  },
];
