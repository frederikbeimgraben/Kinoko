import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { MapStore } from './map.store';

/** Meldet, wie viel ein Blatt oder eine Leiste unten von der Karte verdeckt. */
@Directive({ selector: '[appSheetHeight]' })
export class SheetHeightDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly state = inject(MapStore);

  private readonly observer = new ResizeObserver(() => {
    this.report();
  });

  constructor() {
    this.observer.observe(this.host.nativeElement);
    this.report();
  }

  ngOnDestroy(): void {
    this.observer.disconnect();
    this.state.setOverlayHeight(0);
  }

  /** Der Streifen misst den Weg vom oberen Rand des Elements zum Fensterfuß. Ohne Fläche verdeckt es nichts. */
  private report(): void {
    const element = this.host.nativeElement.querySelector('.sheet') ?? this.host.nativeElement;
    const box = element.getBoundingClientRect();
    const shown = box.width > 0 && box.height > 0;
    this.state.setOverlayHeight(shown ? Math.max(0, Math.round(window.innerHeight - box.top)) : 0);
  }
}
