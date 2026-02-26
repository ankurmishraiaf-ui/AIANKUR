
// Mock localStorage for Node.js environment
global.localStorage = {
  _data: {},
  setItem(key, value) { this._data[key] = value; },
  getItem(key) { return this._data[key] || null; },
  removeItem(key) { delete this._data[key]; },
  clear() { this._data = {}; }
};

import { hashCode, setSecretCode, verifyCode } from '../src/core/auth.js';

describe('Authentication', () => {
  it('hashes code consistently', () => {
    expect(hashCode('1234')).toBe(hashCode('1234'));
  });

  it('sets and verifies code', () => {
    setSecretCode('9999');
    expect(verifyCode('9999')).toBe(true);
    expect(verifyCode('0000')).toBe(false);
  });
});
