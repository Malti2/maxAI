import { create } from 'zustand';
import { ModelId } from '../lib/models';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  tokens?: number;
  createdAt: string;
  streaming?: boolean;
  pending?: boolean; // shown immediately in UI, waiting to be sent to AI
}

export interface Conversation {
  id: string;
  title: string;
  model: string;
  pinned: boolean;
  updatedAt: string;
  createdAt: string;
  messages?: Message[];
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  selectedModel: ModelId;
  isStreaming: boolean;
  sidebarOpen: boolean;
  pendingQueue: string[]; // Chat Mode: messages queued while AI is responding

  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (content: string) => void;
  setStreaming: (v: boolean) => void;
  setSelectedModel: (model: ModelId) => void;
  setSidebarOpen: (v: boolean) => void;
  clearMessages: () => void;
  enqueuePending: (content: string) => void;
  clearPendingQueue: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  selectedModel: 'auto',
  isStreaming: false,
  sidebarOpen: true,
  pendingQueue: [],

  setConversations: (conversations) => set({ conversations }),
  addConversation: (conv) => set((s) => ({ conversations: [conv, ...s.conversations] })),
  updateConversation: (id, updates) => set((s) => ({
    conversations: s.conversations.map(c => c.id === id ? { ...c, ...updates } : c),
  })),
  removeConversation: (id) => set((s) => ({
    conversations: s.conversations.filter(c => c.id !== id),
    activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
    messages: s.activeConversationId === id ? [] : s.messages,
  })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  updateLastMessage: (content) => set((s) => ({
    messages: s.messages.map((m, i) =>
      i === s.messages.length - 1 ? { ...m, content } : m
    ),
  })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  clearMessages: () => set({ messages: [] }),
  enqueuePending: (content) => set((s) => ({ pendingQueue: [...s.pendingQueue, content] })),
  clearPendingQueue: () => set({ pendingQueue: [] }),
}));
