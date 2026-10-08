import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { SvgIconComponent, type IconName } from '../svg-icon/svg-icon.component';
import { ToastService, type ToastVariant } from './toast.service';

const GLYPHS: Readonly<Record<ToastVariant, { name: IconName; stroke: number }>> = {
  success: { name: 'check', stroke: 2.4 },
  danger: { name: 'close', stroke: 2.2 },
  warning: { name: 'warning', stroke: 2.2 },
  info: { name: 'info', stroke: 2.2 },
};

/** The messages of the service, flat across the width, one in each row. */
@Component({
  selector: 'app-toast',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SvgIconComponent],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.scss',
})
export class ToastComponent {
  protected readonly toasts = inject(ToastService);

  protected glyph(variant: ToastVariant): { name: IconName; stroke: number } {
    return GLYPHS[variant];
  }
}
