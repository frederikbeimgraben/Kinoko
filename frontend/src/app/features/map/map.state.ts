import { Injectable, effect, signal } from '@angular/core';
import { BACKGROUNDS, backgroundAvailable, type Background } from '../../map/background';
import type { Detent } from '../../ui/sheet/sheet.component';

/** Die drei Darstellungen des Blatts. */
export type ViewMode = 'forecast' | 'layer' | 'combination';

export const VIEW_MODES: readonly ViewMode[] = ['forecast', 'layer', 'combination'];

/** Ohne Wahl zeigt die Karte diese Art. */
export const DEFAULT_SPECIES = 'boletus-edulis';

/** Ohne Wahl steht der Niederschlag der letzten vier Wochen vorn. */
export const DEFAULT_LAYER = 'regen_4w';

const SLUG_PATTERN = /^[a-z0-9-]{1,60}$/;
const LAYER_PATTERN = /^[a-z0-9_]{1,40}$/;

/** Der Schlüssel im Speicher des Geräts. Eine spätere Form verwirft die alte. */
export const STORAGE_KEY = 'pilzkarte.map.v1';

/** So lange wird gewartet, bevor eine Änderung im Speicher landet. */
export const SAVE_DELAY = 400;

/** Der Zustand, wie er im Speicher liegt. Jedes Feld darf fehlen. Die Woche gehört nicht dazu. */
interface Saved {
  species?: unknown;
  view?: unknown;
  layer?: unknown;
  opacity?: unknown;
  background?: unknown;
  forecastBelow?: unknown;
  showMarkers?: unknown;
  showZones?: unknown;
  showSharedFinds?: unknown;
  detent?: unknown;
}

/** Die drei Arten von Objekt, die ein Blatt über der Karte zeigen kann. */
export const OBJECT_KINDS = ['find', 'marker', 'zone'] as const;
export type ObjectKind = (typeof OBJECT_KINDS)[number];

/** Welches Objekt gerade offen ist. */
export interface OpenObject {
  kind: ObjectKind;
  id: string;
}

function isView(value: unknown): value is ViewMode {
  return typeof value === 'string' && (VIEW_MODES as readonly string[]).includes(value);
}

/** Art, Woche, Darstellung, Ebene und Deckkraft. Die einzige Quelle. */
@Injectable({ providedIn: 'root' })
export class MapState {
  readonly species = signal<string>(DEFAULT_SPECIES);
  /** Ob das Ebenen-Blatt offen ist. Der Knopf dazu steht auf jedem Reiter. */
  readonly layersSheetOpen = signal(false);
  /** Jahr und Woche als `JJJJ-WW`, oder `null` für die aktuelle Woche. */
  readonly week = signal<string | null>(null);
  readonly view = signal<ViewMode>('forecast');
  /** Die gewählte Eingabe-Ebene, `null` heißt „die erste der Liste“. */
  readonly layer = signal<string | null>(null);
  /** Deckkraft der Wertebene, 0 als kein Wert, 1 als volle Deckung. */
  readonly opacity = signal(1);
  readonly background = signal<Background>('map');
  /** In der Darstellung Ebene: die Vorhersage der Art bleibt darunter liegen. */
  readonly forecastBelow = signal(false);
  readonly detent = signal<Detent>(1);

  /** Was außer der Vorhersage auf der Karte liegt. */
  readonly showMarkers = signal(true);
  readonly showZones = signal(true);
  readonly showSharedFinds = signal(true);

  /** Das Objekt-Blatt über der Karte. */
  readonly object = signal<OpenObject | null>(null);

  /** Die Höhe des Blatts über der Karte, in Punkten. Die Karte polstert darauf. */
  readonly overlayHeight = signal(0);

  private writer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.load();
    // Gedrosselt: beim Ziehen eines Reglers ändern sich Signale im Takt der
    // Finger, und jeder Schreibvorgang ginge synchron auf die Platte.
    effect(() => {
      const state = this.asSaved();
      if (this.writer !== null) clearTimeout(this.writer);
      this.writer = setTimeout(() => {
        this.store(state);
      }, SAVE_DELAY);
    });
  }

  /** Nimmt nur an, was es gibt; ein fremder Wert aus dem Speicher fällt weg. */
  setBackground(choice: string): void {
    const found = BACKGROUNDS.find((entry) => entry === choice);
    if (found && backgroundAvailable(found)) this.background.set(found);
  }

  private asSaved(): Saved {
    return {
      species: this.species(),
      view: this.view(),
      layer: this.layer(),
      opacity: this.opacity(),
      background: this.background(),
      forecastBelow: this.forecastBelow(),
      showMarkers: this.showMarkers(),
      showZones: this.showZones(),
      showSharedFinds: this.showSharedFinds(),
      detent: this.detent(),
    };
  }

  private store(state: Saved): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ein gesperrter Speicher ist kein Fehler. Der Zustand gilt dann nur
      // für diese Sitzung.
    }
  }

  /** Ein Wert in falscher Form wird verworfen, nicht übernommen. */
  private load(): void {
    const state = this.readStored();
    if (state === null) return;
    if (typeof state.species === 'string' && SLUG_PATTERN.test(state.species)) {
      this.species.set(state.species);
    }
    if (isView(state.view)) this.view.set(state.view);
    if (typeof state.layer === 'string' && LAYER_PATTERN.test(state.layer)) this.layer.set(state.layer);
    if (typeof state.opacity === 'number' && Number.isFinite(state.opacity)) {
      this.opacity.set(Math.min(Math.max(state.opacity, 0), 1));
    }
    if (typeof state.background === 'string') this.setBackground(state.background);
    if (typeof state.forecastBelow === 'boolean') this.forecastBelow.set(state.forecastBelow);
    if (typeof state.showMarkers === 'boolean') this.showMarkers.set(state.showMarkers);
    if (typeof state.showZones === 'boolean') this.showZones.set(state.showZones);
    if (typeof state.showSharedFinds === 'boolean') this.showSharedFinds.set(state.showSharedFinds);
    if (state.detent === 0 || state.detent === 1 || state.detent === 2) this.detent.set(state.detent);
  }

  private readStored(): Saved | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return null;
      const got: Saved | null = JSON.parse(raw) as Saved | null;
      return typeof got === 'object' ? got : null;
    } catch {
      return null;
    }
  }
}
