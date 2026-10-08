/** The group of an input layer. It gives the name and the icon. */
export type LayerGroup = 'precipitation' | 'temperature' | 'moisture' | 'forest' | 'terrain' | 'soil';

/** Maps each pipeline key to its group. */
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

/** The group icons, as `app-svg-icon` names them. */
export type LayerIcon = 'cloud' | 'thermometer' | 'drop' | 'tree' | 'mountain' | 'layers';

const ICONS: Readonly<Record<LayerGroup, LayerIcon>> = {
  precipitation: 'cloud',
  temperature: 'thermometer',
  moisture: 'drop',
  forest: 'tree',
  terrain: 'mountain',
  soil: 'layers',
};

/** Gives the group of a layer. An unknown layer has no group. */
export function layerGroup(id: string): LayerGroup | null {
  return GROUPS[id] ?? null;
}

export function layerIcon(id: string): LayerIcon | null {
  const group = layerGroup(id);
  return group === null ? null : ICONS[group];
}
