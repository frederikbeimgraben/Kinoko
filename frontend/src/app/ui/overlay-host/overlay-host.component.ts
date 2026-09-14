import { ChangeDetectionStrategy, Component, ElementRef, effect, inject, input, output } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

/** Scrim plus Blatt über einem Slot. Schließt über Scrim, Escape oder Aufrufer. */
@Component({
  selector: 'app-overlay-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './overlay-host.component.html',
  styleUrl: './overlay-host.component.scss',
})
export class OverlayHostComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly open = input.required<boolean>();

  readonly closed = output();

  constructor() {
    // Der Fokus folgt dem geöffneten Blatt, damit Escape sofort greift.
    effect(() => {
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
