import { TestBed } from '@angular/core/testing';
import { ToastService } from '../ui/toast/toast.service';

/** The messages the UI sent, without a visible toast. */
export interface ToastSpy {
  failure: string[];
  success: string[];
}

/** Catches kit messages. A single-component test has no toast container, so the messages go here. */
export function toastSpy(): ToastSpy {
  const service = TestBed.inject(ToastService);
  const spy: ToastSpy = { failure: [], success: [] };
  vi.spyOn(service, 'error').mockImplementation((text: string) => {
    spy.failure.push(text);
    return 0;
  });
  vi.spyOn(service, 'success').mockImplementation((text: string) => {
    spy.success.push(text);
    return 0;
  });
  return spy;
}
