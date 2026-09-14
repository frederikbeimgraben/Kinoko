import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { MapState } from './map.state';

/** Meldet die gemessene Höhe eines Blatts über der Karte an den Zustand. */
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

  private report(): void {
    const sheet = this.host.nativeElement.querySelector('.sheet');
    this.state.overlayHeight.set(sheet?.clientHeight ?? 0);
  }
}
