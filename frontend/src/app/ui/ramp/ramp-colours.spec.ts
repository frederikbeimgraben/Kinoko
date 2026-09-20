import { FORECAST_RAMP, RAIN_RAMP } from './ramp-colours';

describe('Rampenfarben', () => {
  it('trägt die neun Magma-Stufen aus kit.css .legend .ramp', () => {
    expect(FORECAST_RAMP).toEqual([
      '#0d0829',
      '#3b0f70',
      '#721f81',
      '#9f2f7f',
      '#cd4071',
      '#f1605d',
      '#fd9668',
      '#feb078',
      '#fde39a',
    ]);
  });

  it('trägt acht Regenstufen', () => {
    expect(RAIN_RAMP).toHaveLength(8);
  });
});
