import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ViewportService } from '../../core/layout/viewport.service';
import { MAP_ADAPTER } from '../../map/map.tokens';
import { MapAdapterDouble } from '../../testing/map-doubles';
import { StepInput } from './step-input';

function build(wide: boolean): { input: StepInput; map: MapAdapterDouble } {
  const map = new MapAdapterDouble();
  TestBed.configureTestingModule({
    providers: [
      StepInput,
      { provide: MAP_ADAPTER, useValue: map },
      { provide: ViewportService, useValue: { wide: signal(wide) } },
    ],
  });
  return { input: TestBed.inject(StepInput), map };
}

describe('StepInput', () => {
  it('führt am Telefon mit dem Fadenkreuz', () => {
    const { input, map } = build(false);

    input.watch(() => undefined);
    input.aimAt([9.05, 48.52]);

    expect(input.mode()).toBe('crosshair');
    expect(input.aim()).toEqual([9.05, 48.52]);
    expect(map.cursors).not.toContain('crosshair');
  });

  it('folgt am Rechner dem Zeiger und meldet jeden Klick', () => {
    const { input, map } = build(true);
    const picked: (readonly [number, number])[] = [];

    input.watch((point) => picked.push(point));
    map.moved?.([9.1, 48.6]);
    map.clicked?.([9.2, 48.7]);

    expect(input.mode()).toBe('pointer');
    expect(map.cursors).toContain('crosshair');
    expect(input.aim()).toEqual([9.2, 48.7]);
    expect(picked).toEqual([[9.2, 48.7]]);
  });

  it('lässt das Fadenkreuz am Rechner nicht führen', () => {
    const { input, map } = build(true);
    input.watch(() => undefined);
    map.moved?.([9.1, 48.6]);

    input.aimAt([1, 2]);

    expect(input.aim()).toEqual([9.1, 48.6]);
  });

  it('meldet einen Treffer nur nah am Punkt', () => {
    const { input, map } = build(true);
    map.screen = { x: 100, y: 100 };

    expect(input.hits([9, 48], [9, 48])).toBe(true);
  });

  it('gibt Zeiger und Zuhörer wieder frei', () => {
    const { input, map } = build(true);
    input.watch(() => undefined);

    input.stop();

    expect(map.clicked).toBeNull();
    expect(map.cursors.at(-1)).toBe('');
  });
});
