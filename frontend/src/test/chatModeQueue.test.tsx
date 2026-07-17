import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../lib/api', () => ({
  default: { get: vi.fn().mockResolvedValue({ data: { messages: [] } }), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn() },
  refreshAccessToken: vi.fn(),
}));

import { ChatPage } from '../pages/ChatPage';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

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

const now = new Date().toISOString();

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    user: {
      id: 'u1', email: 'a@b.co', name: 'Malte', onboardingDone: true,
      defaultModel: 'auto', personality: 'assistant', chatMode: true,
      soundEnabled: false, avatarColor: '#0a84ff', systemPrompt: null, isAdmin: true,
    },
    accessToken: 'tok', refreshToken: 'r',
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Chat Mode queued messages', () => {
  it('auto-delivers queued messages once the previous turn finishes', async () => {
    useChatStore.setState({
      conversations: [{ id: 'C1', title: 't', model: 'auto', pinned: false, updatedAt: now, createdAt: now }],
      activeConversationId: 'C1',
      // Simulates the state right after a turn finished with a message still
      // queued: the pending bubble is on screen and the buffer holds its text.
      messages: [{ id: 'pending-1', role: 'user', content: 'QUEUED_MESSAGE', createdAt: now, pending: true }],
      isStreaming: false,
      sidebarOpen: true,
      pendingQueue: ['QUEUED_MESSAGE'],
      selectedModel: 'auto',
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sseReader([
        { type: 'user_message', message: { id: 'm1', role: 'user', content: 'QUEUED_MESSAGE', createdAt: now } },
        { type: 'model', model: 'lite' },
        { type: 'delta', content: 'delivered' },
        { type: 'done', message: { id: 'a1', role: 'assistant', content: 'delivered', createdAt: now } },
      ]),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/chat/C1']}>
        <Routes>
          <Route path="/chat/:id" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/chat/conversations/C1/messages');
    expect(JSON.parse(init.body).content).toBe('QUEUED_MESSAGE');

    // The queue is drained and the assistant reply lands.
    await waitFor(() => {
      expect(useChatStore.getState().pendingQueue).toHaveLength(0);
      const assistant = useChatStore.getState().messages.find((m) => m.role === 'assistant');
      expect(assistant?.content).toBe('delivered');
    });
  });

  it('does not deliver anything when Chat Mode is off', async () => {
    useAuthStore.setState({ user: { ...useAuthStore.getState().user!, chatMode: false } });
    useChatStore.setState({
      conversations: [{ id: 'C1', title: 't', model: 'auto', pinned: false, updatedAt: now, createdAt: now }],
      activeConversationId: 'C1',
      messages: [{ id: 'pending-1', role: 'user', content: 'QUEUED_MESSAGE', createdAt: now, pending: true }],
      isStreaming: false,
      sidebarOpen: true,
      pendingQueue: ['QUEUED_MESSAGE'],
      selectedModel: 'auto',
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <MemoryRouter initialEntries={['/chat/C1']}>
        <Routes>
          <Route path="/chat/:id" element={<ChatPage />} />
        </Routes>
      </MemoryRouter>
    );

    // Give effects a chance to run.
    await new Promise((r) => setTimeout(r, 50));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
