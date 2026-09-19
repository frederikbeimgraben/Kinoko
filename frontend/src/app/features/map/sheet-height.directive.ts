import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { MapState } from './map.state';

/** Meldet, wie viel ein Blatt oder eine Leiste unten von der Karte verdeckt. */
@Directive({ selector: '[appSheetHeight]' })
export class SheetHeightDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly state = inject(MapState);

  private readonly observer = new ResizeObserver(() => {
    this.report();
  });

  constructor() {
    this.observer.observe(this.host.nativeElement);
    this.report();
  }

  ngOnDestroy(): void {
    this.observer.disconnect();
    this.state.overlayHeight.set(0);
  }

  /** Der Streifen misst den Weg vom oberen Rand des Elements zum Fensterfuß. Ohne Fläche verdeckt es nichts. */
  private report(): void {
    const element = this.host.nativeElement.querySelector('.sheet') ?? this.host.nativeElement;
    const box = element.getBoundingClientRect();
    const shown = box.width > 0 && box.height > 0;
    this.state.overlayHeight.set(shown ? Math.max(0, Math.round(window.innerHeight - box.top)) : 0);
  }
}
