import { describe, expect, it } from 'vitest';
import { LAUNCH_WINDOW_MS, shouldRegister, type SwEnvironment } from '../../src/pwa';

const WEB: SwEnvironment = { protocol: 'https:', hasServiceWorker: true, native: false, dev: false };

describe('service worker registration', () => {
  it('registers on a production web page', () => {
    expect(shouldRegister(WEB)).toBe(true);
    expect(shouldRegister({ ...WEB, protocol: 'http:' })).toBe(true);
  });

  it('stays out of development builds', () => {
    expect(shouldRegister({ ...WEB, dev: true })).toBe(false);
  });

  it('stays out of a Capacitor wrapper, where the files are already on the device', () => {
    expect(shouldRegister({ ...WEB, native: true })).toBe(false);
  });

  it('needs a browser with service workers and an http(s) origin', () => {
    expect(shouldRegister({ ...WEB, hasServiceWorker: false })).toBe(false);
    for (const protocol of ['file:', 'capacitor:', 'ionic:', 'app:']) expect(shouldRegister({ ...WEB, protocol })).toBe(false);
  });

  it('only switches to a waiting version in the first seconds of a launch', () => {
    expect(LAUNCH_WINDOW_MS).toBeGreaterThan(0);
    expect(LAUNCH_WINDOW_MS).toBeLessThanOrEqual(15_000);
  });
});
