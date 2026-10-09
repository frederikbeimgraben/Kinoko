import { firstValueFrom } from 'rxjs';
import type { PhotosApi } from '../../core/api/photos.api';

/** Sends the files one after the other. `false` means that a file did not go out.
 * A failed photo upload does not make the find fail. */
export async function attachPhotos(
  api: PhotosApi,
  findId: string,
  photographer: string,
  files: readonly File[],
): Promise<boolean> {
  for (const file of files) {
    try {
      await firstValueFrom(api.ofFind(findId, photographer, file));
    } catch {
      return false;
    }
  }
  return true;
}
