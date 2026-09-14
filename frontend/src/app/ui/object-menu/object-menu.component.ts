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
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** Punkt, an dem das Menü öffnet: die Stelle des langen Drucks. */
export interface ObjectMenuTarget {
  readonly x: number;
  readonly y: number;
}

/** Aktionsmenü nach langem Drücken: Bearbeiten, Zentrieren, Löschen. */
@Component({
  selector: 'app-object-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent, TranslatePipe],
  templateUrl: './object-menu.component.html',
  styleUrl: './object-menu.component.scss',
})
export class ObjectMenuComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly target = input<ObjectMenuTarget | null>(null);

  readonly edit = output();
  readonly centre = output();
  readonly delete = output();
  readonly closed = output();

  constructor() {
    // Der Fokus folgt dem geöffneten Menü, damit Pfeile und Escape greifen.
    // Erst nach dem Rendern stehen die Einträge im Baum.
    afterRenderEffect(() => {
      if (this.target() !== null) this.items()[0]?.focus();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closed.emit();
      return;
    }
    const step = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const items = this.items();
    const at = items.indexOf(document.activeElement as HTMLElement);
    items[(at + step + items.length) % items.length]?.focus();
  }

  private items(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.objectmenu__item'));
  }
}
