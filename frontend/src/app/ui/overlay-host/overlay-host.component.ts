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
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Ein Slot: am Telefon ein Blatt von unten, am Rechner ein Modal. */
@Component({
  selector: 'app-overlay-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './overlay-host.component.html',
  styleUrl: './overlay-host.component.scss',
})
export class OverlayHostComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  private readonly viewport = inject(ViewportService);

  readonly open = input.required<boolean>();
  /** Ein modales Blatt dunkelt ab; ein Blatt über der Karte lässt sie sehen. */
  readonly modal = input(false);
  /** Der Kopf des Modals am Rechner. Ohne Titel trägt der Inhalt ihn selbst. */
  readonly title = input('');
  /** Ein Modal für wenige Zeilen: schmaler und nur so hoch wie sein Inhalt. */
  readonly compact = input(false);

  protected readonly wide = this.viewport.wide;

  readonly closed = output();

  constructor() {
    // Der Fokus folgt dem geöffneten Blatt, damit Escape sofort greift.
    // Erst nach dem Rendern steht das Panel im Baum.
    afterRenderEffect(() => {
      if (this.open()) this.panel()?.focus();
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
