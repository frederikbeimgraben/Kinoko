/** Die Gruppe einer Eingabe-Ebene: sie gibt den Namen und das Zeichen. */
export type LayerGroup = 'precipitation' | 'temperature' | 'moisture' | 'forest' | 'terrain' | 'soil';

/** Die Gruppe je Schlüssel der Kette. */
const GROUPS: Readonly<Record<string, LayerGroup>> = {
  regen: 'precipitation',
  regen_2w: 'precipitation',
  regen_4w: 'precipitation',
  regen_8w: 'precipitation',
  regen_anomalie: 'precipitation',
  regen_tage_seit: 'precipitation',
  temperatur: 'temperature',
  temperatur_min: 'temperature',
  temperatur_max: 'temperature',
  temperatur_2w: 'temperature',
  temperatur_4w: 'temperature',
  frosttage: 'temperature',
  hitzetage: 'temperature',
  luftfeuchte: 'moisture',
  bodenfeuchte: 'moisture',
  wald: 'forest',
  fichte: 'forest',
  buche: 'forest',
  eiche: 'forest',
  birke: 'forest',
  kiefer: 'forest',
  nadelholz: 'forest',
  hoehe: 'terrain',
  hangneigung: 'terrain',
  nordexposition: 'terrain',
  relief: 'terrain',
  gelaendeposition: 'terrain',
  boden_ph: 'soil',
  boden_sand: 'soil',
  boden_kohlenstoff: 'soil',
};

/** Die Zeichen der Gruppen, wie `app-svg-icon` sie nennt. */
export type LayerIcon = 'cloud' | 'thermometer' | 'drop' | 'tree' | 'mountain' | 'layers';

/** Das Zeichen je Gruppe. */
const ICONS: Readonly<Record<LayerGroup, LayerIcon>> = {
  precipitation: 'cloud',
  temperature: 'thermometer',
  moisture: 'drop',
  forest: 'tree',
  terrain: 'mountain',
  soil: 'layers',
};

/** Die Gruppe einer Ebene. Eine unbekannte Ebene hat keine. */
export function layerGroup(id: string): LayerGroup | null {
  return GROUPS[id] ?? null;
}

/** Das Zeichen der Gruppe einer Ebene. */
export function layerIcon(id: string): LayerIcon | null {
  const group = layerGroup(id);
  return group === null ? null : ICONS[group];
}
