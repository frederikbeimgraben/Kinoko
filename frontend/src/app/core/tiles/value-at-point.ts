import { fits } from './tile-cache';
import { tilePath } from './tile-paths';
import { covers } from './coverage';
import type { SpeciesManifest } from './manifest';

/** A value tile is 256 pixels wide, as the renderer writes it. */
const TILE_PIXELS = 256;

/**
 * The tile and the pixel in it. It is separate from the calculation, so a test can check the grid without an image.
 */
export interface TileLocation {
  z: number;
  x: number;
  y: number;
  pixelX: number;
  pixelY: number;
}

/** Converts longitude and latitude to tile and pixel at one zoom level. */
export function tileLocation(lon: number, lat: number, zoom: number): TileLocation {
  const n = 2 ** zoom;
  const sinus = Math.sin((Math.min(Math.max(lat, -85.05), 85.05) * Math.PI) / 180);
  const exactX = ((lon + 180) / 360) * n;
  const exactY = (0.5 - Math.log((1 + sinus) / (1 - sinus)) / (4 * Math.PI)) * n;
  const x = Math.min(Math.max(Math.floor(exactX), 0), n - 1);
  const y = Math.min(Math.max(Math.floor(exactY), 0), n - 1);
  return {
    z: zoom,
    x,
    y,
    pixelX: Math.min(TILE_PIXELS - 1, Math.floor((exactX - x) * TILE_PIXELS)),
    pixelY: Math.min(TILE_PIXELS - 1, Math.floor((exactY - y) * TILE_PIXELS)),
  };
}

/**
 * Converts a value tile byte to a probability. Byte 0 means no data. Else `(byte - 1) / 254 * top`.
 */
export function valueFromByte(byte: number, top: number): number | null {
  return byte === 0 ? null : ((byte - 1) / 254) * top;
}

// The forecast at a point, from the finest tile of the week. The map uses the same tile, so there is one source of truth.
// Without tile, canvas or network, there is no value, and the sheet hides the row.
export async function valueAtPoint(
  manifest: SpeciesManifest,
  weekFolder: string,
  lon: number,
  lat: number,
): Promise<number | null> {
  for (let zoom = manifest.zoomTo; zoom >= manifest.zoomFrom; zoom--) {
    const location = tileLocation(lon, lat, zoom);
    if (!covers(manifest, location.z, location.x, location.y)) continue;
    const byte = await readByte(tilePath(weekFolder, location.z, location.x, location.y), location);
    if (byte !== null) return valueFromByte(byte, manifest.top);
  }
  return null;
}

async function readByte(url: string, location: TileLocation): Promise<number | null> {
  try {
    const reply = await fetch(url);
    // An origin without the file can send the app page with status 200.
    if (!reply.ok || !fits(reply, 'image')) return null;
    const shot = await createImageBitmap(await reply.blob());
    const canvas = new OffscreenCanvas(shot.width, shot.height);
    const pen = canvas.getContext('2d', { willReadFrequently: true });
    if (!pen) return null;
    pen.drawImage(shot, 0, 0);
    shot.close();
    // The value tile is gray, so the red channel holds the byte.
    return pen.getImageData(location.pixelX, location.pixelY, 1, 1).data[0];
  } catch {
    return null;
  }
}
