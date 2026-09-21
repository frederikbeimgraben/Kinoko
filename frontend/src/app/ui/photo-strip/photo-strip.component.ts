import { ChangeDetectionStrategy, Component, computed, input, output, type OnDestroy } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LevelPillComponent } from '../level-pill/level-pill.component';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Wie viele Bilder ein Fund oder eine Einreichung höchstens trägt. */
const MAX_PHOTOS = 3;

/** Ein Foto, das der Dienst schon kennt. */
export interface StripPhoto {
  readonly id: string;
  readonly path: string;
  readonly lead?: boolean;
}

/** Eine noch nicht gesendete Kachel: die Datei und ihre Objekt-URL. */
interface PendingTile {
  readonly file: File;
  readonly preview: string;
}

export type PhotoStripMode = 'view' | 'edit';

/** Die Fotoleiste: `view` zeigt Bilder an, `edit` fügt sie hinzu und entfernt sie. */
@Component({
  selector: 'app-photo-strip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LevelPillComponent, PrivateImageComponent, RippleDirective, SvgIconComponent, TranslatePipe],
  templateUrl: './photo-strip.component.html',
  styleUrl: './photo-strip.component.scss',
})
export class PhotoStripComponent implements OnDestroy {
  readonly mode = input.required<PhotoStripMode>();
  /** Die Fotos, die der Dienst schon hat. */
  readonly photos = input<readonly StripPhoto[]>([]);
  /** Neue, noch nicht gesendete Dateien. Nur im Modus `edit`. */
  readonly pending = input<readonly File[]>([]);
  readonly max = input(MAX_PHOTOS);
  /** Ohne das bleibt jede Kachel fest, auch im Modus `edit`. */
  readonly removable = input(true);

  readonly pendingChange = output<readonly File[]>();
  readonly removed = output<string>();
  readonly opened = output<number>();

  private readonly previews = new Map<File, string>();

  protected readonly pendingTiles = computed<readonly PendingTile[]>(() => {
    const current = this.pending();
    const kept = new Set(current);
    for (const [file, url] of this.previews) {
      if (kept.has(file)) continue;
      URL.revokeObjectURL(url);
      this.previews.delete(file);
    }
    return current.map((file) => {
      const preview = this.previews.get(file) ?? URL.createObjectURL(file);
      this.previews.set(file, preview);
      return { file, preview };
    });
  });

  protected readonly canAdd = computed(
    () => this.mode() === 'edit' && this.photos().length + this.pending().length < this.max(),
  );

  protected onPick(event: Event): void {
    const field = event.target as HTMLInputElement;
    const picked = Array.from(field.files ?? []);
    field.value = '';
    if (picked.length === 0) return;
    const room = this.max() - this.photos().length - this.pending().length;
    this.pendingChange.emit([...this.pending(), ...picked.slice(0, room)]);
  }

  protected removePending(file: File): void {
    const preview = this.previews.get(file);
    if (preview !== undefined) {
      URL.revokeObjectURL(preview);
      this.previews.delete(file);
    }
    this.pendingChange.emit(this.pending().filter((entry) => entry !== file));
  }

  /** Eine Objekt-URL bleibt sonst im Speicher, wenn die Seite neu lädt. */
  ngOnDestroy(): void {
    for (const url of this.previews.values()) URL.revokeObjectURL(url);
    this.previews.clear();
  }
}
