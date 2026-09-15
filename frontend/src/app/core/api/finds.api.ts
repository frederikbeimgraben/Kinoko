import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { Viewbox } from '../../map/tile-grid';
import { ApiClient } from './api-client';
import type { components } from './contract';
import type { SharedFind } from './models';

type FindEntry = components['schemas']['Find'];
type FindPage = components['schemas']['FindPage'];

const PATH = '/finds';

/** So viele Funde holt eine Seite. Der Vertrag erlaubt höchstens 50. */
const PAGE_SIZE = 50;

/** Ein fehlender Weg bleibt still: die Karte hält den Stand, den sie zeigt. */
const NOT_FOUND = 404;

function bbox(view: Viewbox): string {
  return [view.west, view.south, view.ost, view.nord].join(',');
}

/** Ein Fund ohne Ort, Datum oder Prüfstand gehört auf keine Karte. */
function sharedFind(entry: FindEntry): SharedFind | null {
  const { lat, lon, foundOn, reviewState } = entry;
  if (lat === undefined || lon === undefined || foundOn === undefined) return null;
  if (reviewState === undefined) return null;
  return {
    id: entry.id,
    speciesId: entry.speciesId ?? null,
    lat,
    lon,
    foundOn,
    count: entry.count ?? null,
    note: entry.note ?? null,
    reviewState,
  };
}

/** Die Funde des Vertrags. Geteilte Funde liest auch ein Gerät ohne Konto. */
@Injectable({ providedIn: 'root' })
export class FindsApi {
  private readonly api = inject(ApiClient);

  /** Die geteilten Funde im Ausschnitt. Ohne Ausschnitt kommt die ganze Karte. */
  shared(view?: Viewbox): Observable<readonly SharedFind[]> {
    return this.api
      .get<FindPage>(
        PATH,
        { mine: false, bbox: view ? bbox(view) : undefined, limit: PAGE_SIZE },
        { quietStatus: [NOT_FOUND] },
      )
      .pipe(map((answer) => answer.items.flatMap((entry) => sharedFind(entry) ?? [])));
  }
}
