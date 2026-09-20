import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  type OnDestroy,
} from '@angular/core';
import { ApiClient } from '../../core/api/api-client';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** Ein Bild ohne öffentlichen Zugriff. Es lädt mit Token als Objekt-URL. */
@Component({
  selector: 'app-private-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './private-image.component.html',
  styleUrl: './private-image.component.scss',
})
export class PrivateImageComponent implements OnDestroy {
  private readonly api = inject(ApiClient);

  /** Der Pfad aus der Antwort, ohne `/api`. Ohne Weg zeigt das Feld das Ersatzsymbol. */
  readonly path = input<string>('');
  readonly alt = input.required<string>();
  /** `cover` füllt die Fläche, `contain` passt ein, `natural` nimmt die Höhe des Bildes. */
  readonly fit = input<'cover' | 'contain' | 'natural'>('cover');
  /** Zeigt das Schloss, wenn nur der Besitzer das Bild sehen darf. */
  readonly locked = input(false);
  /** Grundfarbe des Ersatzsymbols, ohne Weg oder solange die Datei fehlt. */
  readonly colour = input('#7a5230');
  readonly icon = input<IconName>('mushroom');
  /** Tinte des Ersatzsymbols: hell auf dunkler Farbe, dunkel auf heller. */
  readonly ink = input<'light' | 'dark'>('light');

  protected readonly source = signal<string | null>(null);

  /** Die Objekt-URL als einfaches Feld. Der Effekt liest kein Signal. */
  private held: string | null = null;

  constructor() {
    effect(() => {
      const path = this.path();
      this.release();
      if (!path) return;
      this.api.getBlob(path.replace(/^\/api/, '')).subscribe({
        next: (data) => {
          this.held = URL.createObjectURL(data);
          this.source.set(this.held);
        },
        // Der ApiClient meldet den Fehler schon per Toast.
        // Die Fläche bleibt hier leer statt ein kaputtes Bild zu zeigen.
        error: () => {
          this.source.set(null);
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.release();
  }

  /** Eine offene Objekt-URL bleibt sonst dauerhaft im Speicher. */
  private release(): void {
    if (this.held !== null) URL.revokeObjectURL(this.held);
    this.held = null;
    this.source.set(null);
  }
}
