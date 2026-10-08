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
import { RippleDirective } from '../ripple/ripple.directive';
import { SvgIconComponent } from '../svg-icon/svg-icon.component';

/** The point where the menu opens: the place of the long press. */
export interface ObjectMenuTarget {
  readonly x: number;
  readonly y: number;
}

/** The action menu after a long press: edit, centre, delete. */
@Component({
  selector: 'app-object-menu',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RippleDirective, SvgIconComponent, TranslatePipe],
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
    // The focus goes to the open menu, so the arrow keys and Escape work.
    // The items are in the tree only after the render.
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
