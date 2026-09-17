import { ChangeDetectionStrategy, Component, computed, input, output, type OnDestroy } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PrivateImageComponent } from '../private-image/private-image.component';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

const MAX_PHOTOS = 3;

/** Eine Bildkachel: die Datei und ihre Objekt-URL für die Vorschau. */
interface Tile {
  readonly file: File;
  readonly preview: string;
}

/** Ein Foto, das der Dienst schon hat: seine Kennung und sein Weg. */
export interface HeldPhoto {
  readonly id: string;
  readonly path: string;
}

/** Bildkacheln mit Vorschau und eine Kachel zum Hinzufügen. Höchstens drei. */
@Component({
  selector: 'app-photo-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PrivateImageComponent, SvgIconComponent, TranslatePipe],
  templateUrl: './photo-picker.component.html',
  styleUrl: './photo-picker.component.scss',
})
export class PhotoPickerComponent implements OnDestroy {
  readonly files = input<readonly File[]>([]);
  /** Fotos, die der Dienst schon hat. Sie stehen vor den neuen Dateien. */
  readonly held = input<readonly HeldPhoto[]>([]);

  readonly filesChange = output<readonly File[]>();
  readonly heldRemoved = output<string>();

  private readonly previews = new Map<File, string>();

  protected readonly tiles = computed<readonly Tile[]>(() => {
    const current = this.files();
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

  protected readonly canAdd = computed(() => this.files().length + this.held().length < MAX_PHOTOS);

  protected onPick(event: Event): void {
    const field = event.target as HTMLInputElement;
    const picked = Array.from(field.files ?? []);
    field.value = '';
    if (picked.length === 0) return;
    const room = MAX_PHOTOS - this.files().length - this.held().length;
    this.filesChange.emit([...this.files(), ...picked.slice(0, room)]);
  }

  protected remove(file: File): void {
    const preview = this.previews.get(file);
    if (preview !== undefined) {
      URL.revokeObjectURL(preview);
      this.previews.delete(file);
    }
    this.filesChange.emit(this.files().filter((entry) => entry !== file));
  }

  /** Eine Objekt-URL bleibt sonst im Speicher, wenn die Seite neu lädt. */
  ngOnDestroy(): void {
    for (const url of this.previews.values()) URL.revokeObjectURL(url);
    this.previews.clear();
  }
}
