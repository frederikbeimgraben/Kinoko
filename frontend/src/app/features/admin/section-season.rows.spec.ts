import { curvePaths, endWeek, monthOfWeek, seasonCurve, startWeek } from './section-season.rows';

describe('section-season.rows', () => {
  it('gibt die erste und die letzte Woche eines Monats', () => {
    expect(startWeek(1)).toBe(1);
    expect(endWeek(12)).toBe(52);
    expect(startWeek(7)).toBe(27);
  });

  it('gibt einer Woche den Monat ihres Donnerstags', () => {
    expect(monthOfWeek(1)).toBe(1);
    expect(monthOfWeek(38)).toBe(9);
    expect(monthOfWeek(53)).toBe(12);
  });

  it('hat den höchsten Wert in der Woche des Höhepunkts', () => {
    const curve = seasonCurve(6, 10, 38);

    expect(curve.indexOf(Math.max(...curve))).toBe(37);
    expect(curve[0]).toBeLessThan(0.01);
  });

  it('legt die Kurve ohne Höhepunkt in die Mitte des Zeitraums, auch über den Jahreswechsel', () => {
    const summer = seasonCurve(6, 10, null);
    const winter = seasonCurve(11, 2, null);

    expect(summer.indexOf(Math.max(...summer)) + 1).toBe(33);
    expect(winter[51] + winter[0]).toBeGreaterThan(1.5);
  });

  it('schließt die Fläche an der Grundlinie', () => {
    const { line, area } = curvePaths([0, 1, 0], 10, 4);

    expect(line).toBe('M0.0,4.0 L3.3,4.0 L6.7,0.0 L10.0,4.0');
    expect(area).toBe(`${line} L10,4 L0,4 Z`);
  });
});
