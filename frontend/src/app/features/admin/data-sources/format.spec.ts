import { bytesText, durationText, fileProblem, metaValue, shortSha } from './format';

const ACCEPT = { extensions: ['.zip', '.TIF'], mediaTypes: [], maxBytes: 1000 };

describe('data source formats', () => {
  it('writes a size in the largest fitting unit', () => {
    expect(bytesText(512, 'en')).toBe('512 byte');
    expect(bytesText(1536, 'en')).toBe('1.5 kB');
    expect(bytesText(16 * 1024 * 1024, 'de')).toBe('16 MB');
    expect(bytesText(0, 'en')).toBe('0 byte');
  });

  it('writes a duration in its largest unit', () => {
    expect(durationText(20, 'en')).toBe('20 sec');
    expect(durationText(150, 'en')).toBe('3 min');
    expect(durationText(5400, 'en')).toBe('1.5 hr');
  });

  it('checks the extension without case and the size limit', () => {
    expect(fileProblem('Trees.ZIP', 10, ACCEPT)).toBeNull();
    expect(fileProblem('map.tif', 10, ACCEPT)).toBeNull();
    expect(fileProblem('map.png', 10, ACCEPT)).toBe('type');
    expect(fileProblem('map.zip', 1001, ACCEPT)).toBe('size');
  });

  it('shortens a checksum and writes metadata values', () => {
    expect(shortSha('0123456789abcdef')).toBe('0123456789ab');
    expect(shortSha(null)).toBe('');
    expect(metaValue([2014, 2026], 'en')).toBe('2014, 2026');
    expect(metaValue('EPSG:3035', 'en')).toBe('EPSG:3035');
    expect(metaValue({ a: 1 }, 'en')).toBe('{"a":1}');
  });
});
