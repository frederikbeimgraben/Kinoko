import { firstValueFrom } from 'rxjs';
import type { PhotosApi } from '../../core/api/photos.api';

/** A failed photo upload does not make the find fail. */
export async function attachPhotos(
  api: PhotosApi,
  findId: string,
  photographer: string,
  files: readonly File[],
): Promise<void> {
  for (const file of files) {
    try {
      await firstValueFrom(api.ofFind(findId, photographer, file));
    } catch {
      break;
    }
  }
}
