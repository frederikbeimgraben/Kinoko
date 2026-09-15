import { firstValueFrom } from 'rxjs';
import type { PhotosApi } from '../../core/api/photos.api';

/** Ein Foto, das nicht durchgeht, kostet nicht den Fund. */
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
