/** Die längste Kante eines hochgeladenen Fotos. */
export const MAX_EDGE = 1600;

/** Die Güte der neuen JPEG-Datei. */
export const QUALITY = 0.85;

const TYPE = 'image/jpeg';

/** Die Zielgröße: die längste Kante bleibt unter der Grenze, das Verhältnis bleibt. */
export function targetSize(
  width: number,
  height: number,
  max = MAX_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) return { width, height };
  const factor = max / longest;
  return { width: Math.round(width * factor), height: Math.round(height * factor) };
}

/** Der Name der neuen Datei: derselbe Stamm, die Endung des neuen Typs. */
export function jpegName(name: string): string {
  const stem = name.replace(/\.[^./\\]+$/, '');
  return `${stem || 'foto'}.jpg`;
}

/**
 * Zeichnet das Foto neu und gibt es ohne Metadaten zurück.
 *
 * Das neu gezeichnete Bild trägt weder EXIF noch GPS. Kann das Gerät nicht
 * zeichnen, bricht der Aufruf ab: das Original verlässt das Gerät nie.
 */
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
