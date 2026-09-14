import { firstValueFrom } from 'rxjs';
import type { EntriesApi } from '../../core/api/entries.api';
import type { Find } from '../../core/api/models';

/** Ein Foto, das nicht durchgeht, kostet nicht den Fund. */
export async function attachPhotos(api: EntriesApi, find: Find, fotos: readonly File[]): Promise<Find> {
  let done = find;
  for (const file of fotos) {
    try {
      const photo = await firstValueFrom(api.addPhoto(find.id, file));
      done = { ...done, fotos: [...done.fotos, photo] };
    } catch {
      break;
    }
  }
  return done;
}
