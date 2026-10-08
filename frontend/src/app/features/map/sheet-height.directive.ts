import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { MapStore } from './map.store';

/** Reports how much of the map a sheet or a bar covers at the bottom. */
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

  /** The strip goes from the top edge of the element to the bottom of the window. Without an area, it covers nothing. */
  private report(): void {
    const element = this.host.nativeElement.querySelector('.sheet') ?? this.host.nativeElement;
    const box = element.getBoundingClientRect();
    const shown = box.width > 0 && box.height > 0;
    this.state.setOverlayHeight(shown ? Math.max(0, Math.round(window.innerHeight - box.top)) : 0);
  }
}
