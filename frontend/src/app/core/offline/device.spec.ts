import { deviceId } from './device';

describe('deviceId', () => {
  it('bleibt über die Sitzung hinaus gleich', () => {
    const first = deviceId();

    expect(deviceId()).toBe(first);
    expect(first).toMatch(/[0-9a-f-]{36}/);
  });

  it('liefert auch ohne Speicher eine Kennung', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('gesperrt');
    });

    expect(deviceId()).toMatch(/[0-9a-f-]{36}/);
  });
});
