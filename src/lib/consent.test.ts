import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); vi.restoreAllMocks(); });

describe('Firefox bookmarksInfo 授权', () => {
  it('Chromium 不需要授权，也不调用 permissions', async () => {
    vi.stubEnv('BROWSER', 'chrome');
    const spy = vi.spyOn(browser.permissions, 'request');
    const c = await import('./consent');
    expect(c.NEEDS_DATA_CONSENT).toBe(false);
    expect(await c.requestBookmarksConsent()).toBe(true);
    expect(c.withBookmarksConsent({ origins: ['https://a/*'] })).toEqual({ origins: ['https://a/*'] });
    expect(spy).not.toHaveBeenCalled();
  });

  it('Firefox：合并到其他授权请求里，拒绝时抛错', async () => {
    vi.stubEnv('BROWSER', 'firefox');
    vi.spyOn(browser.permissions, 'request').mockResolvedValue(false as never);
    const c = await import('./consent');
    expect(c.withBookmarksConsent({ origins: ['https://a/*'] })).toEqual({ origins: ['https://a/*'], data_collection: ['bookmarksInfo'] });
    await expect(c.ensureBookmarksConsent()).rejects.toThrow();
  });

  it('Firefox：不在用户操作里请求被拒时，退回查询已有授权', async () => {
    vi.stubEnv('BROWSER', 'firefox');
    vi.spyOn(browser.permissions, 'request').mockRejectedValue(new Error('may only be called from a user input handler'));
    vi.spyOn(browser.permissions, 'contains').mockResolvedValue(true as never);
    const c = await import('./consent');
    await expect(c.ensureBookmarksConsent()).resolves.toBeUndefined();
  });
});
