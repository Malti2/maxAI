import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock the axios instance so no real network calls happen.
vi.mock('../lib/api', () => {
  const get = vi.fn();
  return { default: { get, post: vi.fn(), patch: vi.fn(), delete: vi.fn(), put: vi.fn() } };
});

import api from '../lib/api';
import { Sidebar } from '../components/layout/Sidebar';
import { ChatPage } from '../pages/ChatPage';
import { useChatStore } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';

const now = new Date().toISOString();

function seedStores() {
  useAuthStore.setState({
    user: {
      id: 'u1', email: 'a@b.co', name: 'Malte', onboardingDone: true,
      defaultModel: 'auto', personality: 'assistant', chatMode: false,
      soundEnabled: false, avatarColor: '#0a84ff', systemPrompt: null, isAdmin: false,
    },
    accessToken: 't', refreshToken: 'r',
  });
  useChatStore.setState({
    conversations: [
      { id: 'A', title: 'Conversation Alpha', model: 'auto', pinned: false, updatedAt: now, createdAt: now },
      { id: 'B', title: 'Conversation Bravo', model: 'auto', pinned: false, updatedAt: now, createdAt: now },
    ],
    activeConversationId: null,
    messages: [],
    isStreaming: false,
    sidebarOpen: true,
    pendingQueue: [],
  });
}

function Harness() {
  return (
    <div>
      <Sidebar onNewChat={() => {}} />
      <Routes>
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/chat/:id" element={<ChatPage />} />
      </Routes>
    </div>
  );
}

beforeEach(() => {
  seedStores();
  (api.get as ReturnType<typeof vi.fn>).mockReset();
  (api.get as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
    if (url === '/chat/conversations/A') {
      return Promise.resolve({ data: { messages: [{ id: 'mA', role: 'user', content: 'ALPHA_MESSAGE_BODY', createdAt: now }] } });
    }
    if (url === '/chat/conversations/B') {
      return Promise.resolve({ data: { messages: [{ id: 'mB', role: 'user', content: 'BRAVO_MESSAGE_BODY', createdAt: now }] } });
    }
    return Promise.resolve({ data: { messages: [] } });
  });
});

describe('conversation navigation', () => {
  it('loads the messages of a conversation opened from the sidebar', async () => {
    render(
      <MemoryRouter initialEntries={['/chat/A']}>
        <Harness />
      </MemoryRouter>
    );

    // Conversation A opens on first render.
    expect(await screen.findByText('ALPHA_MESSAGE_BODY')).toBeInTheDocument();

    // Switching to B from the sidebar must load B's messages.
    await userEvent.click(screen.getByText('Conversation Bravo'));
    expect(await screen.findByText('BRAVO_MESSAGE_BODY')).toBeInTheDocument();
  });
});
