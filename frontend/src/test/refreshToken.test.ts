import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios so the refresh helper's network call is fully controllable and the
// module-level `axios.create()` in api.ts still works.
const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('axios', () => {
  const instance = {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };
  const create = vi.fn(() => instance);
  return { default: { create, post }, create, post };
});

import { refreshAccessToken } from '../lib/api';
import { useAuthStore } from '../store/authStore';

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, accessToken: 'old', refreshToken: 'r0' });
});

describe('refreshAccessToken', () => {
  it('logs out and returns null when there is no refresh token', async () => {
    useAuthStore.setState({ refreshToken: null });
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');
    const token = await refreshAccessToken();
    expect(token).toBeNull();
    expect(logoutSpy).toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it('stores and returns the new access token on success', async () => {
    post.mockResolvedValue({ data: { accessToken: 'fresh', refreshToken: 'r1' } });
    const token = await refreshAccessToken();
    expect(token).toBe('fresh');
    expect(useAuthStore.getState().accessToken).toBe('fresh');
    expect(useAuthStore.getState().refreshToken).toBe('r1');
  });

  it('coalesces concurrent refreshes into a single request (single-flight)', async () => {
    let resolvePost: (v: unknown) => void = () => {};
    post.mockImplementation(() => new Promise((r) => { resolvePost = r; }));

    const p1 = refreshAccessToken();
    const p2 = refreshAccessToken();
    resolvePost({ data: { accessToken: 'fresh', refreshToken: 'r1' } });
    const [t1, t2] = await Promise.all([p1, p2]);

    expect(t1).toBe('fresh');
    expect(t2).toBe('fresh');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('logs out and returns null when the refresh request fails', async () => {
    post.mockRejectedValue(new Error('nope'));
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout');
    const token = await refreshAccessToken();
    expect(token).toBeNull();
    expect(logoutSpy).toHaveBeenCalled();
  });
});
