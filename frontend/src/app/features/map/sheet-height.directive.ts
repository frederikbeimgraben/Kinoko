import { Directive, ElementRef, OnDestroy, inject } from '@angular/core';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { MapStore } from './map.store';

/** Reports how much of the map a sheet or a bar covers at the bottom. */
// A slide-in moves the sheet with a transform, which the resize observer does not see. The end of each motion measures again.
@Directive({
  selector: '[appSheetHeight]',
  host: { '(document:animationend)': 'report()', '(document:transitionend)': 'report()' },
})
export class SheetHeightDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly state = inject(MapStore);
  private readonly adapter = inject(MAP_ADAPTER, { optional: true });

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

  /** The strip goes from the top edge of the element to the bottom of the map: the nav bar below the map is not part of it. */
  protected report(): void {
    const element = this.host.nativeElement.querySelector('.sheet') ?? this.host.nativeElement;
    const box = element.getBoundingClientRect();
    const shown = box.width > 0 && box.height > 0;
    const bottom =
      this.adapter?.rawMap()?.getContainer().getBoundingClientRect().bottom ?? window.innerHeight;
    this.state.setOverlayHeight(shown ? Math.max(0, Math.round(bottom - box.top)) : 0);
  }
}
