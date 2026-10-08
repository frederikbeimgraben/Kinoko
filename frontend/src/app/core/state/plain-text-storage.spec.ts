import { plainTextStorage } from './plain-text-storage';

describe('plainTextStorage', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('writes a string value as bare text', () => {
    plainTextStorage()().setItem('test.plain', JSON.stringify('dark'));

    expect(localStorage.getItem('test.plain')).toBe('dark');
  });

  it('reads bare text as a JSON string', () => {
    localStorage.setItem('test.plain', 'dark');

    expect(plainTextStorage()().getItem('test.plain')).toBe('"dark"');
  });

  it('keeps a value that is not a string as JSON', () => {
    plainTextStorage()().setItem('test.plain', '{"a":1}');

    expect(localStorage.getItem('test.plain')).toBe('{"a":1}');
  });

  it('gives null for a missing key and removes a key', () => {
    const storage = plainTextStorage()();
    storage.setItem('test.plain', '"x"');
    storage.removeItem('test.plain');

    expect(storage.getItem('test.plain')).toBeNull();
  });
});
