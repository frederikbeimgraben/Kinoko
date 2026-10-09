import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly variant: ToastVariant;
}

const AUTO_DISMISS_MS = 4000;

/** Message hub. Callers use `success` or `error`, and `app-toast` shows the message. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<readonly Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private nextId = 0;

  /** Shows a message, but not a second time while the same message shows.
   * With `timeout=0`, the message does not close by itself. */
  show(message: string, variant: ToastVariant = 'info', timeout = AUTO_DISMISS_MS): number {
    // Parallel failures give the same message. One copy is sufficient.
    const shown = this._toasts().find((toast) => toast.message === message && toast.variant === variant);
    if (shown !== undefined) return shown.id;
    const id = this.nextId++;
    this._toasts.update((all) => [...all, { id, message, variant }]);
    if (timeout > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, timeout);
    }
    return id;
  }

  success(message: string): number {
    return this.show(message, 'success');
  }

  error(message: string): number {
    return this.show(message, 'danger');
  }

  dismiss(id: number): void {
    this._toasts.update((all) => all.filter((toast) => toast.id !== id));
  }
}
