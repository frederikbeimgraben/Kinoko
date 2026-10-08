/** Six decimal places are eleven centimeters. No find location needs more. */
const DIGITS = 6;

/** The URL that opens OpenStreetMap at a point, zoom 17. */
export function osmUrl(location: readonly [number, number]): string {
  const [lon, lat] = location;
  const la = lat.toFixed(DIGITS);
  const lo = lon.toFixed(DIGITS);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=17/${la}/${lo}`;
}

/** The URL that opens Google Maps at a point. */
export function googleMapsUrl(location: readonly [number, number]): string {
  const [lon, lat] = location;
  const query = `${lat.toFixed(DIGITS)},${lon.toFixed(DIGITS)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** The `geo:` link that the phone operating system opens. */
export function geoUri(location: readonly [number, number]): string {
  const [lon, lat] = location;
  return `geo:${lat.toFixed(DIGITS)},${lon.toFixed(DIGITS)}`;
}
