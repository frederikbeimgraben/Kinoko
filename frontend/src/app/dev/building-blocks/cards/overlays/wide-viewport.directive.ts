import { Directive, signal } from '@angular/core';
import { ViewportService } from '../../../../core/layout/viewport.service';

/** Gives the children the desktop view, so a sheet in a narrow card shows as a modal. */
@Directive({
  selector: '[appWideViewport]',
  providers: [{ provide: ViewportService, useValue: { wide: signal(true).asReadonly() } }],
})
export class WideViewportDirective {}
