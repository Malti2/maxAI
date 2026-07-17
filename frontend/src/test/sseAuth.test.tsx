import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('../lib/api', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  refreshAccessToken: vi.fn(),
}));

import { useChat } from '../hooks/useChat';
import { refreshAccessToken } from '../lib/api';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';

function sseReader(events: Array<Record<string, unknown>>) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    getReader() {
      return {
        read() {
          if (i < events.length) {
            const chunk = encoder.encode(`data: ${JSON.stringify(events[i++])}\n\n`);
            return Promise.resolve({ done: false, value: chunk });
          }
          return Promise.resolve({ done: true, value: undefined });
        },
        cancel() { return Promise.resolve(); },
      };
    },
  };
}

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, null, children);

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    user: {
      id: 'u1', email: 'a@b.co', name: 'Malte', onboardingDone: true,
      defaultModel: 'auto', personality: 'assistant', chatMode: false,
      soundEnabled: false, avatarColor: '#0a84ff', systemPrompt: null, isAdmin: false,
    },
    accessToken: 'expired', refreshToken: 'r',
  });
  useChatStore.setState({
    conversations: [{ id: 'C1', title: 't', model: 'auto', pinned: false, updatedAt: new Date().toISOString(), createdAt: new Date().toISOString() }],
    activeConversationId: 'C1',
    messages: [],
    isStreaming: false,
    sidebarOpen: true,
    pendingQueue: [],
    selectedModel: 'auto',
  });
  vi.spyOn(toast, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('SSE send with an expired access token', () => {
  it('refreshes the token on 401 and retries the stream successfully', async () => {
    (refreshAccessToken as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      useAuthStore.getState().setTokens('fresh', 'r2');
      return 'fresh';
    });

    const fetchMock = vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      const auth = (init.headers as Record<string, string>).Authorization;
      if (auth === 'Bearer fresh') {
        return Promise.resolve({
          ok: true,
          status: 200,
          body: sseReader([
            { type: 'model', model: 'lite' },
            { type: 'delta', content: 'Hi from Max' },
            { type: 'done', message: { id: 'a1', role: 'assistant', content: 'Hi from Max', createdAt: new Date().toISOString() } },
          ]),
        });
      }
      // Stale token → rejected.
      return Promise.resolve({ ok: false, status: 401, body: null });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat(), { wrapper });
    await act(async () => {
      await result.current.sendMessage('hello there');
    });

    await waitFor(() => {
      const assistant = useChatStore.getState().messages.find((m) => m.role === 'assistant');
      expect(assistant?.content).toBe('Hi from Max');
    });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('surfaces an error when the refresh also fails', async () => {
    (refreshAccessToken as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, body: null });
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useChat(), { wrapper });
    await act(async () => {
      await result.current.sendMessage('hello there');
    });

    await waitFor(() => {
      const assistant = useChatStore.getState().messages.find((m) => m.role === 'assistant');
      expect(assistant?.content).toContain('Something went wrong');
    });
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });
});
