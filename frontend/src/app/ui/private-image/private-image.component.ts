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

/** Ein Bild ohne öffentlichen Zugriff. Es lädt mit Token als Objekt-URL. */
@Component({
  selector: 'app-private-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './private-image.component.html',
  styleUrl: './private-image.component.scss',
})
export class PrivateImageComponent implements OnDestroy {
  private readonly api = inject(ApiClient);

  /** Der Pfad aus der Antwort, ohne `/api`. */
  readonly path = input.required<string>();
  readonly alt = input.required<string>();

  protected readonly source = signal<string | null>(null);

  /** Die Objekt-URL als einfaches Feld. Der Effekt liest kein Signal. */
  private held: string | null = null;

  constructor() {
    effect(() => {
      const path = this.path();
      this.release();
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
