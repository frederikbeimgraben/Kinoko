import {
  type AnimationCallbackEvent,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { ViewportService } from '../../core/layout/viewport.service';
import { clearMotion, playMotion, type MotionStep } from './overlay-motion';

/** A slot above `app-sheet`: open or closed, the scrim on the phone, Escape. */
@Component({
  selector: 'app-overlay-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './overlay-host.component.html',
  styleUrl: './overlay-host.component.scss',
})
export class OverlayHostComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** The window decides, not the place in the tree: a host outside the shell never finds `.shell--column`. */
  protected readonly wide = inject(ViewportService).wide;

  readonly open = input.required<boolean>();
  /** A modal sheet darkens the page. A sheet over the map keeps the map visible. */
  readonly modal = input(false);

  readonly closed = output();

  constructor() {
    // The focus goes to the open sheet, so Escape works at once.
    // The panel is in the tree only after the render.
    afterRenderEffect(() => {
      if (!this.open()) return;
      // The content can set the focus itself. Only a sheet without its own target moves it to the panel.
      if (this.host.nativeElement.contains(document.activeElement)) return;
      this.panel()?.focus({ preventScroll: true });
    });
  }

  /** The phone slides the panel up. The desktop pops the modal of the sheet in the panel. */
  protected onEnter(event: AnimationCallbackEvent): void {
    this.play(event, 'in');
  }

  // The modal is in the view of `app-sheet`. Angular does not run a leave animation in a child component view.
  protected onLeave(event: AnimationCallbackEvent): void {
    this.play(event, 'out');
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    this.closed.emit();
  }

  // A projected sheet can stay alive while the panel is closed, so each class goes away after its motion.
  private play(event: AnimationCallbackEvent, way: 'in' | 'out'): void {
    const steps = this.motion(event.target, way);
    void playMotion(steps).then(() => {
      clearMotion(steps);
      event.animationComplete();
    });
  }

  private motion(panel: Element, way: 'in' | 'out'): MotionStep[] {
    if (!this.wide()) return [[panel, `motion-sheet-${way}`]];
    return [
      [panel.querySelector('.sheet--modal'), `motion-pop-${way}`],
      [panel.querySelector('.sheet__scrim'), `motion-fade-${way}`],
    ];
  }

  private panel(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.overlay__panel');
  }
}
