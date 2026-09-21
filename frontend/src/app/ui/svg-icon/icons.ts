/** Die Piktogramme aus dem Design, ein Pfadinhalt je Name. */
export type IconName =
  | 'map'
  | 'map-off'
  | 'wifi-off'
  | 'species'
  | 'entries'
  | 'account'
  | 'more'
  | 'plus'
  | 'location'
  | 'layers'
  | 'back'
  | 'forward'
  | 'close'
  | 'check'
  | 'zone'
  | 'search'
  | 'warning'
  | 'info'
  | 'compare'
  | 'lock'
  | 'empty'
  | 'image-gap'
  | 'left'
  | 'right'
  | 'play'
  | 'pause'
  | 'cloud'
  | 'drop'
  | 'tree'
  | 'mountain'
  | 'calendar'
  | 'rainfall'
  | 'thermometer'
  | 'frost'
  | 'forest'
  | 'conifer'
  | 'leaf'
  | 'elevation'
  | 'slope'
  | 'compass'
  | 'relief'
  | 'ridge'
  | 'club'
  | 'grains'
  | 'soil-layers'
  | 'trash'
  | 'undo'
  | 'filter'
  | 'camera'
  | 'chevron'
  | 'hourglass'
  | 'refresh'
  | 'sign-out'
  | 'upload'
  | 'mushroom'
  | 'flag'
  | 'eat'
  | 'palette'
  | 'ruler'
  | 'sort'
  | 'caret'
  | 'caretup'
  | 'menu'
  | 'gills'
  | 'edit'
  | 'image'
  | 'minus'
  | 'sun'
  | 'download'
  | 'share'
  | 'open'
  | 'chevl'
  | 'star';

/** Die drei gefüllten Pfeile und die Wiedergabe sitzen auf einem 12er-Raster. */
export const FILLED_ICONS: readonly IconName[] = ['left', 'right', 'play', 'pause'];

export const DESIGN_ICON_NAMES: Readonly<Record<string, IconName>> = {
  pin: 'entries',
  locate: 'location',
  chev: 'chevron',
  logout: 'sign-out',
  offline: 'wifi-off',
  thermo: 'thermometer',
  reset: 'refresh',
};

/** Der Inhalt des `<svg>` je Piktogramm, Strich 2 auf Raster 24 ausser den gefüllten. */
export const ICONS: Record<IconName, string> = {
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/>',
  'map-off': '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/><path d="M3 21L21 3"/>',
  'wifi-off':
    '<path d="M3 3l18 18M5 12.5a10 10 0 0 1 4-2.5M2 9a15 15 0 0 1 5-3M12 5a15 15 0 0 1 10 4M15 10.5a10 10 0 0 1 4 2M9 16a4.5 4.5 0 0 1 6 0M12 20h.010"/>',
  species: '<path d="M4 11a8 6 0 0 1 16 0H4z"/><path d="M9 11v7a3 3 0 0 0 6 0v-7"/>',
  entries:
    '<path d="M12 21s-7-6.200-7-11a7 7 0 0 1 14 0c0 4.800-7 11-7 11zM9.5 10a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0"/>',
  account: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6"/>',
  more: '<path d="M10.2 5a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0M10.2 12a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0M10.2 19a1.8 1.8 0 1 0 3.6 0a1.8 1.8 0 1 0 -3.6 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  location:
    '<path d="M5 12a7 7 0 1 0 14 0a7 7 0 1 0 -14 0M9.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"/>',
  back: '<path d="M20 12H5M11 6l-6 6 6 6"/>',
  forward: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  zone: '<path d="M12 3 21 9l-3 11H6L3 9z"/>',
  search: '<path d="M4.5 11a6.5 6.5 0 1 0 13 0a6.5 6.5 0 1 0 -13 0M16 16l4.500 4.500"/>',
  warning: '<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4M12 17.2v.1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.1"/>',
  compare: '<path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"/>',
  empty: '<path d="M4 10h16l-1.6 9H5.6z"/><path d="M4 10l4-6M20 10l-4-6"/><path d="M10 13.5v2M14 13.5v2"/>',
  'image-gap':
    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6.5 15c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5z"/><path d="M12 15v2.5"/>',
  left: '<path d="M8.5 1.5 3.5 6l5 4.5z"/>',
  right: '<path d="M3.5 1.5 8.5 6l-5 4.5z"/>',
  play: '<path d="M3 1.4 10 6 3 10.6Z"/>',
  pause: '<path d="M2.5 1.5h2.5v9h-2.5zM7 1.5h2.5v9h-2.5z"/>',
  cloud: '<path d="M7 18a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.5 1.5A3.800 3.800 0 0 1 17.500 18z"/>',
  drop: '<path d="M12 3s6 7 6 11.5a6 6 0 0 1-12 0C6 10 12 3 12 3z"/>',
  tree: '<path d="M10 5a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M4 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M16 19a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M12 7v5M6 17v-3h12v3"/>',
  mountain: '<path d="M3 19h18L14 7l-3.5 6L8.5 10z"/>',
  calendar:
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><rect x="7" y="13" width="3" height="3" rx="0.6"/>',
  rainfall: '<path d="M3 12h4l3-6 4 12 3-6h4"/>',
  thermometer: '<path d="M10 4a2 2 0 0 1 4 0v9.500a4 4 0 1 1-4 0zM12 8v8"/>',
  frost: '<path d="M14 14.2V5.5a2 2 0 1 0-4 0v8.7a3.8 3.8 0 1 0 4 0z"/><path d="M17 4l3 3M20 4l-3 3"/>',
  forest: '<path d="M12 3l4.5 6.5h-2.6L18 15H6l4.1-5.5H7.5z"/><path d="M12 15v5.5"/><path d="M4 20.5h16"/>',
  conifer: '<path d="M12 2.5l3.6 5.4h-2L17 13h-2.2l3 4.5H6.2l3-4.5H7l3.4-5.1h-2z"/><path d="M12 17.5v4"/>',
  leaf: '<path d="M12 21c0-6 1.5-9.5 6-12.5C20 11 19 17 13.5 18.6"/><path d="M12 21c0-4-1-7-5-9"/>',
  elevation: '<path d="M3 19h18"/><path d="M4.5 19l5.5-9 3 4.5 2.5-3.5L20 19"/><path d="M8 10.5h4"/>',
  slope: '<path d="M3.5 19.5h17"/><path d="M4.5 19.5L15 6.5l5.5 13"/><path d="M9 19.5v-3.5h3.5"/>',
  compass:
    '<path d="M12 2L15 12L9 12Z" fill="var(--color-danger)" stroke="none"/><path d="M12 22L15 12L9 12Z" fill="var(--color-text-muted)" stroke="none"/>',
  relief: '<path d="M3 16c2.5-4 4-4 6.5 0M7 20c3-6 6.5-6 10 0M11 12c1.6-2.6 3.2-2.6 4.8 0"/>',
  ridge: '<path d="M4 18h16"/><path d="M5 18c2-7 5-10 7-10s5 3 7 10"/><circle cx="12" cy="8" r="1.8"/>',
  club: '<path d="M8 3v6.5L4.6 17A3 3 0 0 0 7.3 21h9.4a3 3 0 0 0 2.7-4L16 9.5V3"/><path d="M7 3h10"/><path d="M6.2 14.5h11.6"/>',
  grains:
    '<circle cx="7" cy="9" r="1.4"/><circle cx="13" cy="7.5" r="1"/><circle cx="17.5" cy="10.5" r="1.4"/><circle cx="9.5" cy="14" r="1"/><circle cx="15" cy="15.5" r="1.4"/><path d="M3.5 19.5h17"/>',
  'soil-layers':
    '<path d="M3.5 9.5h17"/><path d="M4 13h16M4.5 16.5h15"/><path d="M9 9.5c0-3 1.5-5 3-6 1.5 1 3 3 3 6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  undo: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
  filter:
    '<path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 7a2 2 0 1 0 4 0a2 2 0 1 0 -4 0M6 17a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/>',
  camera:
    '<path d="M4 8a1 1 0 0 1 1-1h2l1.5-2h7L17 7h2a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  chevron: '<path d="M9 6l6 6-6 6"/>',
  hourglass: '<path d="M6 3h12M6 21h12M8 3v4l4 5 4-5V3M8 21v-4l4-5 4 5v4"/>',
  refresh: '<path d="M4.5 12a7.5 7.5 0 1 0 2.6-5.7M4 4.500v4.500h4.500"/>',
  'sign-out': '<path d="M10 4H5v16h5M14 8l4 4-4 4M8 12h10"/>',
  upload:
    '<path d="M7 18a4.500 4.500 0 0 1-.500-9 6 6 0 0 1 11.500 1.500A3.800 3.800 0 0 1 17.500 18M12 12v8M9 15l3-3 3 3"/>',
  mushroom: '<path d="M4 11a8 8 0 0 1 16 0zM10 11v6a2 2 0 0 0 4 0v-6"/>',
  flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
  eat: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 2-3 5-3 8h3v10"/>',
  palette:
    '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0M7.7 10a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0M11.2 7.5a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0M14.7 10a0.8 0.8 0 1 0 1.6 0a0.8 0.8 0 1 0 -1.6 0"/>',
  ruler: '<path d="M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2"/>',
  sort: '<path d="M4 7h16M4 12h10M4 17h5"/>',
  caret: '<path d="M7 10l5 5 5-5"/>',
  caretup: '<path d="M7 14l5-5 5 5"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  gills: '<path d="M3 12a9 9 0 0 1 18 0zM8 12V8M12 12V6M16 12V8"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
  image: '<path d="M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M8.5 9.500a1 1 0 1 0 2 0a1 1 0 1 0-2 0"/>',
  minus: '<path d="M5 12h14"/>',
  sun: '<path d="M8 12a4 4 0 1 0 8 0a4 4 0 1 0 -8 0M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/>',
  download: '<path d="M12 4v11M8 11l4 4 4-4M5 19h14"/>',
  share:
    '<path d="M15.5 5a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M3.5 12a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M15.5 19a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0 -5 0M8.2 10.800l7.600-4.500M8.200 13.200l7.600 4.500"/>',
  open: '<path d="M14 4h6v6M20 4l-9 9M18 13v6H5V6h6"/>',
  chevl: '<path d="M15 6l-6 6 6 6"/>',
  star: '<path d="M12 4l2.5 5.200 5.700.700-4.200 3.900 1.100 5.600L12 16.600 6.900 19.400 8 13.800 3.800 9.900l5.700-.700z"/>',
};
