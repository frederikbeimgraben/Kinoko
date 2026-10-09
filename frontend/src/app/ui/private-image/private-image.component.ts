import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ApiClient } from '../../core/api/api-client';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';

/** The relative luminance above which the light ink of the boards is lost: white and cream tones. */
const LIGHT_LUMINANCE = 0.5;

/** True for a light hex colour. A value that does not parse counts as dark. */
export function isLight(hex: string): boolean {
  const match = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (match === null) return false;
  const [red, green, blue] = match.slice(1).map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue > LIGHT_LUMINANCE;
}

/** An image without public access. It loads with the token and shows as an object URL. */
@Component({
  selector: 'app-private-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './private-image.component.html',
  styleUrl: './private-image.component.scss',
  host: { '[class.private--loading]': 'loading()', '[class.motion-shimmer]': 'loading()' },
})
export class PrivateImageComponent {
  private readonly api = inject(ApiClient);

  /** The path from the response, without `/api`. Without a path, the area shows the fallback icon. */
  readonly path = input<string>('');
  readonly alt = input.required<string>();
  /** `cover` fills the area, `contain` fits the image in it, `natural` uses the height of the image. */
  readonly fit = input<'cover' | 'contain' | 'natural'>('cover');
  /** Shows the lock when only the owner can see the image. */
  readonly locked = input(false);
  /** The colour behind the fallback icon. */
  readonly colour = input('#7a5230');
  readonly icon = input<IconName>('mushroom');
  /** The ink of the fallback icon. `auto` takes dark ink on a light colour and light ink on a dark one. */
  readonly ink = input<'light' | 'dark' | 'auto'>('auto');
  /** `tile` is an icon on the colour, per `.sq`. `hero` is the large outline icon of `kit.css` `.hero`. */
  readonly fallback = input<'tile' | 'hero'>('tile');

  protected readonly darkInk = computed(() => {
    const ink = this.ink();
    return ink === 'auto' ? isLight(this.colour()) : ink === 'dark';
  });

  /** The ApiClient reports an error with a toast. The area then stays empty, not a broken image. */
  private readonly file = rxResource({
    params: () => this.path() || undefined,
    stream: ({ params }) => this.api.getBlob(params.replace(/^\/api/, '')),
  });

  /** While the file loads, the area is a skeleton block in the shape of its host. */
  protected readonly loading = computed(() => this.file.isLoading());
  protected readonly source = computed(() => {
    const data = this.file.hasValue() ? this.file.value() : undefined;
    return data ? URL.createObjectURL(data) : null;
  });

  constructor() {
    // An open object URL stays in memory until it is revoked.
    effect((onCleanup) => {
      const url = this.source();
      if (url !== null)
        onCleanup(() => {
          URL.revokeObjectURL(url);
        });
    });
  }
}
