import { Injectable, inject } from '@angular/core';
import { map, type Observable } from 'rxjs';
import type { Viewbox } from '../../map/tile-grid';
import { ApiClient } from './api-client';
import type { components } from './contract';
import { ENTRY_PATHS } from './entry-paths';
import { openFind, sharedFind } from './entry-reader';
import type { OpenFind, SharedFind } from './models';

type ReviewDecision = components['schemas']['ReviewDecision'];

const REVIEWS = `${ENTRY_PATHS.find}/reviews`;

type FindPage = components['schemas']['FindPage'];

/** Finds per page. The contract allows a maximum of 50. */
const PAGE_SIZE = 50;

/** A 404 gives no error message. The map keeps the data that it shows. */
const NOT_FOUND = 404;

function bbox(view: Viewbox): string {
  return [view.west, view.south, view.ost, view.nord].join(',');
}

/** The contract finds. A device without an account can also read shared finds. */
@Injectable({ providedIn: 'root' })
export class FindsApi {
  private readonly api = inject(ApiClient);

  /** The shared finds in the view. Without a view, you get the full map. */
  shared(view?: Viewbox): Observable<readonly SharedFind[]> {
    return this.api
      .get<FindPage>(
        ENTRY_PATHS.find,
        { mine: false, bbox: view ? bbox(view) : undefined, limit: PAGE_SIZE },
        { quietStatus: [NOT_FOUND] },
      )
      .pipe(map((answer) => answer.items.flatMap((entry) => sharedFind(entry) ?? [])));
  }

  /** The open finds of all accounts. Needs the `find.review` permission. */
  open(): Observable<readonly OpenFind[]> {
    return this.api
      .get<FindPage>(`${REVIEWS}/open`, { limit: PAGE_SIZE })
      .pipe(map((answer) => answer.items.flatMap((entry) => openFind(entry) ?? [])));
  }

  review(id: string, decision: ReviewDecision): Observable<null> {
    return this.api.post<null>(`${ENTRY_PATHS.find}/${encodeURIComponent(id)}/review`, { decision });
  }

  acceptAll(): Observable<null> {
    return this.api.post<null>(`${REVIEWS}/accept-all`);
  }
}
