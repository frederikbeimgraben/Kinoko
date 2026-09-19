import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { injectRouteParam } from './route-param';

function routeFor(params: Record<string, string>): { provide: typeof ActivatedRoute; useValue: unknown } {
  const map = convertToParamMap(params);
  return { provide: ActivatedRoute, useValue: { paramMap: of(map), snapshot: { paramMap: map } } };
}

@Component({ selector: 'app-route-param-host', template: '' })
class HostComponent {
  readonly slug = injectRouteParam('slug');
  readonly id = injectRouteParam('id', 'neu');
}

function build(params: Record<string, string>): HostComponent {
  TestBed.configureTestingModule({ providers: [routeFor(params)] });
  return TestBed.createComponent(HostComponent).componentInstance;
}

describe('injectRouteParam', () => {
  it('liest den benannten Parameter aus der Route', () => {
    const host = build({ slug: 'boletus-edulis' });

    expect(host.slug()).toBe('boletus-edulis');
  });

  it('nimmt den Rückfallwert, wenn der Parameter fehlt', () => {
    const host = build({});

    expect(host.id()).toBe('neu');
  });

  it('nimmt einen leeren Text als Rückfallwert ohne zweites Argument', () => {
    const host = build({});

    expect(host.slug()).toBe('');
  });
});
