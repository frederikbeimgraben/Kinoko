import { Directive, ElementRef, afterNextRender, inject, input, output } from '@angular/core';

let nextNumber = 0;

/** The panel of a layer: role, focus, Escape and the name of the layer. */
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

  /** A name for the layer. Without it, the title in the panel gives the name. */
  readonly label = input('', { alias: 'appModalLayer' });

  readonly dismissed = output();

  /** The title has this id. The panel refers to it with `aria-labelledby`. */
  readonly labelId = `app-modal-layer-${String(nextNumber++)}`;

  constructor() {
    afterNextRender(() => {
      this.host.nativeElement.focus();
    });
  }

  // Escape applies to the top layer. Without `stopPropagation`, a dialog in a sheet also closes the sheet.
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    this.dismissed.emit();
  }
}
