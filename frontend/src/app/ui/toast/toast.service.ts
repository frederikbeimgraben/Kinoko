import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger';

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly variant: ToastVariant;
}

const AUTO_DISMISS_MS = 4000;

/** Meldungshub. Eine Zeile ruft `success` oder `error`, `app-toast` rendert. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<readonly Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private nextId = 0;

  /** Zeigt eine Meldung; `timeout=0` lässt das Schließen von selbst weg. */
  show(message: string, variant: ToastVariant = 'info', timeout = AUTO_DISMISS_MS): number {
    const id = this.nextId++;
    this._toasts.update((all) => [...all, { id, message, variant }]);
    if (timeout > 0) setTimeout(() => this.dismiss(id), timeout);
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
