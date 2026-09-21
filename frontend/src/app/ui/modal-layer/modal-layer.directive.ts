import { Directive, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

let nextNumber = 0;

/** Das Blatt einer Schicht: Rolle, Fokus, Escape und der Name der Schicht. */
@Directive({
  selector: '[appModalLayer]',
  exportAs: 'modalLayer',
  host: {
    role: 'dialog',
    'aria-modal': 'true',
    tabindex: '-1',
    '[attr.aria-label]': 'label() === "" ? null : label()',
    '[attr.aria-labelledby]': 'label() === "" ? labelId : null',
    '(keydown)': 'onKeydown($event)',
  },
})
export class ModalLayerDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Ein eigener Name der Schicht. Ohne ihn trägt der Titel im Blatt den Namen. */
  readonly label = input('', { alias: 'appModalLayer' });

  readonly dismissed = output();

  /** Der Titel trägt diese Kennung, das Blatt zeigt mit `aria-labelledby` darauf. */
  readonly labelId = `app-modal-layer-${String(nextNumber++)}`;

  constructor() {
    afterNextRender(() => {
      this.host.nativeElement.focus();
    });
  }

  // Escape gilt der obersten Schicht. Ohne `stopPropagation` schlösse ein
  // Dialog im Blatt auch das Blatt darunter.
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.emit();
  }
}
