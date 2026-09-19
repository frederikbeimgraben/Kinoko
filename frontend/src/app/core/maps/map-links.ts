/** Sechs Nachkommastellen sind elf Zentimeter. Mehr trägt kein Fundort. */
const DIGITS = 6;

/** Die Adresse, die OpenStreetMap auf einen Punkt führt, Zoom 17. */
export function osmUrl(location: readonly [number, number]): string {
  const [lon, lat] = location;
  const la = lat.toFixed(DIGITS);
  const lo = lon.toFixed(DIGITS);
  return `https://www.openstreetmap.org/?mlat=${la}&mlon=${lo}#map=17/${la}/${lo}`;
}

/** Die Adresse, die Google Maps auf einen Punkt führt. */
export function googleMapsUrl(location: readonly [number, number]): string {
  const [lon, lat] = location;
  const query = `${lat.toFixed(DIGITS)},${lon.toFixed(DIGITS)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Der `geo:`-Verweis, den das Betriebssystem des Telefons öffnet. */
export function geoUri(location: readonly [number, number]): string {
  const [lon, lat] = location;
  return `geo:${lat.toFixed(DIGITS)},${lon.toFixed(DIGITS)}`;
}
