import { create } from 'zustand';
import { ModelId } from '../lib/models';

export interface WebSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  tokens?: number;
  createdAt: string;
  streaming?: boolean;
  pending?: boolean; // shown immediately in UI, waiting to be sent to AI
  edited?: boolean;
  reaction?: string | null; // tapback reaction (Chat Mode only)
  replyToId?: string | null; // id of the message this one replies to
  sources?: WebSource[] | null; // web-search sources cited by this answer
}

// What the assistant placeholder shows while a turn is being prepared.
export type SearchState = 'idle' | 'searching' | 'reading';

export interface Conversation {
  id: string;
  title: string;
  model: string;
  pinned: boolean;
  updatedAt: string;
  createdAt: string;
  preview?: string;
  messages?: Message[];
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];
  // Which conversation the `messages` array belongs to. The chat page uses this
  // to decide whether it still has to load a conversation from the API — asking
  // `activeConversationId` instead would race with the router and wipe the
  // optimistic messages of a conversation that was just created in this tab.
  messagesConversationId: string | null;
  selectedModel: ModelId;
  isStreaming: boolean;
  sidebarOpen: boolean;
  pendingQueue: string[]; // Chat Mode: messages queued while AI is responding
  webSearch: boolean; // grounding the next answer in web results
  webSearchAvailable: boolean; // whether this deployment allows web search at all
  searchState: SearchState;
  sessionTokens: number; // tokens used since this tab was opened

  setConversations: (convs: Conversation[]) => void;
  addConversation: (conv: Conversation) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  removeConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  /**
   * Replace the message list. Pass `conversationId` to claim the list for a
   * specific conversation (defaults to the active one).
   */
  setMessages: (messages: Message[], conversationId?: string | null) => void;
  addMessage: (message: Message) => void;
  updateMessageContent: (id: string, content: string) => void;
  patchMessage: (id: string, patch: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  removeMessagesAfter: (id: string, inclusive?: boolean) => void;
  setMessageReaction: (id: string, reaction: string | null) => void;
  setStreaming: (v: boolean) => void;
  setSelectedModel: (model: ModelId) => void;
  setSidebarOpen: (v: boolean) => void;
  clearMessages: () => void;
  enqueuePending: (content: string) => void;
  clearPendingQueue: () => void;
  setWebSearch: (v: boolean) => void;
  setWebSearchAvailable: (v: boolean) => void;
  setSearchState: (s: SearchState) => void;
  addSessionTokens: (n: number) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: [],
  messagesConversationId: null,
  selectedModel: 'auto',
  isStreaming: false,
  sidebarOpen: true,
  pendingQueue: [],
  webSearch: false,
  webSearchAvailable: true,
  searchState: 'idle',
  sessionTokens: 0,

  setConversations: (conversations) => set({ conversations }),
  addConversation: (conv) => set((s) => ({ conversations: [conv, ...s.conversations] })),
  updateConversation: (id, updates) =>
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    })),
  removeConversation: (id) =>
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
      messages: s.activeConversationId === id ? [] : s.messages,
      messagesConversationId: s.messagesConversationId === id ? null : s.messagesConversationId,
    })),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  setMessages: (messages, conversationId) =>
    set((s) => ({
      messages,
      messagesConversationId: conversationId !== undefined ? conversationId : s.activeConversationId,
    })),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  updateMessageContent: (id, content) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, content } : m)) })),
  patchMessage: (id, patch) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
  removeMessage: (id) => set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),
  removeMessagesAfter: (id, inclusive = false) =>
    set((s) => {
      const idx = s.messages.findIndex((m) => m.id === id);
      if (idx === -1) return {};
      return { messages: s.messages.slice(0, inclusive ? idx : idx + 1) };
    }),
  setMessageReaction: (id, reaction) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, reaction } : m)) })),
  setStreaming: (isStreaming) => set({ isStreaming }),
  setSelectedModel: (selectedModel) => set({ selectedModel }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  clearMessages: () => set({ messages: [], messagesConversationId: null }),
  enqueuePending: (content) => set((s) => ({ pendingQueue: [...s.pendingQueue, content] })),
  clearPendingQueue: () => set({ pendingQueue: [] }),
  setWebSearch: (webSearch) => set({ webSearch }),
  setWebSearchAvailable: (webSearchAvailable) => set({ webSearchAvailable }),
  setSearchState: (searchState) => set({ searchState }),
  addSessionTokens: (n) => set((s) => ({ sessionTokens: s.sessionTokens + n })),
}));
