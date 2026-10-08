/** The maximum edge length of an uploaded photo. */
export const MAX_EDGE = 1600;

/** The quality of the new JPEG file. */
export const QUALITY = 0.85;

const TYPE = 'image/jpeg';

/** The target size. The longest edge stays in the limit, and the aspect ratio stays. */
export function targetSize(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) return { width, height };
  const factor = max / longest;
  return { width: Math.round(width * factor), height: Math.round(height * factor) };
}

/** The new file name: the same stem with the extension of the new type. */
export function jpegName(name: string): string {
  const stem = name.replace(/\.[^./\\]+$/, '');
  return `${stem || 'foto'}.jpg`;
}

/** Draws the photo again. The new image has no EXIF or GPS data. */
export async function withoutMetadata(file: File, max = MAX_EDGE): Promise<File> {
  const source = await createImageBitmap(file);
  const size = targetSize(source.width, source.height, max);
  const canvas = new OffscreenCanvas(size.width, size.height);
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('canvas');
  context.drawImage(source, 0, 0, size.width, size.height);
  source.close();
  const blob = await canvas.convertToBlob({ type: TYPE, quality: QUALITY });
  return new File([blob], jpegName(file.name), { type: TYPE });
}
