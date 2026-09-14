import { Directive, ElementRef, afterNextRender, inject, output } from '@angular/core';

let nextNumber = 0;

/** Das Blatt einer Schicht: Rolle, Fokus, Escape und die Kennung des Titels. */
@Directive({
  selector: '[appModalLayer]',
  exportAs: 'modalLayer',
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    tabindex: '-1',
    '[attr.aria-labelledby]': 'labelId',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ModalLayerDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly dismissed = output();

  /** Der Titel trägt diese Kennung, das Blatt zeigt mit `aria-labelledby` darauf. */
  readonly labelId = `app-modal-layer-${String(nextNumber++)}`;

  constructor() {
    afterNextRender(() => {
      this.host.nativeElement.focus();
    });
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.dismissed.emit();
  }
}
