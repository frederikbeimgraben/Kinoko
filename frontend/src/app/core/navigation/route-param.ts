import { inject, type Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { map } from 'rxjs';

/** One route parameter as a signal. Uses `fallback` while the parameter is absent. */
export function injectRouteParam(name: string, fallback = ''): Signal<string> {
  const route = inject(ActivatedRoute);
  return toSignal(route.paramMap.pipe(map((params) => params.get(name) ?? fallback)), {
    initialValue: route.snapshot.paramMap.get(name) ?? fallback,
  });
}
