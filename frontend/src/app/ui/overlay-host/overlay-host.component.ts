import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';

/** Ein Slot über `app-sheet`: offen oder zu, Scrim am Telefon, Escape. */
@Component({
  selector: 'app-overlay-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './overlay-host.component.html',
  styleUrl: './overlay-host.component.scss',
})
export class OverlayHostComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Das Fenster entscheidet, nicht die Lage im Baum: ein Host außerhalb der Hülle trifft sonst nie auf `.shell--column`. */
  protected readonly wide = inject(ViewportService).wide;

  readonly open = input.required<boolean>();
  /** Ein modales Blatt dunkelt ab; ein Blatt über der Karte lässt sie sehen. */
  readonly modal = input(false);
  /** Ein deckendes Blatt liegt über dem ganzen Fenster, auch über der Leiste. */
  readonly cover = input(false);

  readonly closed = output();

  constructor() {
    // Der Fokus folgt dem geöffneten Blatt, damit Escape sofort greift.
    // Erst nach dem Rendern steht das Panel im Baum.
    afterRenderEffect(() => {
      if (!this.open()) return;
      // Der Inhalt darf den Fokus selbst setzen. Nur ein Blatt ohne eigenes
      // Ziel holt ihn auf das Panel.
      if (this.host.nativeElement.contains(document.activeElement)) return;
      this.panel()?.focus({ preventScroll: true });
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.closed.emit();
  }

  private panel(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.overlay__panel');
  }
}
