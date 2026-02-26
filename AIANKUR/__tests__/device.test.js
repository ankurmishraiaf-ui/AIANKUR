import { collectPasswordsEmailsAndroid, connectAndroidDevice } from '../src/core/android.js';
import { collectPasswordsEmailsIphone, connectIphoneDevice } from '../src/core/iphone.js';

describe('Android Device', () => {
  it('collects passwords and emails', async () => {
    const data = await collectPasswordsEmailsAndroid('demo');
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty('email');
    expect(data[0]).toHaveProperty('password');
  });
  it('connects to device', async () => {
    const result = await connectAndroidDevice('token');
    expect(result.connected).toBe(true);
  });
});

describe('iPhone Device', () => {
  it('collects passwords and emails', async () => {
    const data = await collectPasswordsEmailsIphone('demo');
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty('email');
    expect(data[0]).toHaveProperty('password');
  });
  it('connects to device', async () => {
    const result = await connectIphoneDevice('token');
    expect(result.connected).toBe(true);
  });
});
