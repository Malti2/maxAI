import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { EmptyState } from '../components/chat/EmptyState';
import { useChatStore, type Message } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useChat } from '../hooks/useChat';
import api from '../lib/api';
import { Menu, ChevronDown } from 'lucide-react';
import { ModelBadge } from '../components/ui/ModelBadge';
import type { ModelId } from '../lib/models';
import type { ReactionType } from '../lib/reactions';

export const ChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    messages, setMessages, activeConversationId, setActiveConversation,
    conversations, sidebarOpen, setSidebarOpen, isStreaming,
    enqueuePending, addMessage, setMessageReaction,
  } = useChatStore();
  const { user } = useAuthStore();
  const { sendMessage, stopStreaming } = useChat();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const chatModeEnabled = user?.chatMode ?? false;

  // Load conversation
  useEffect(() => {
    if (id && id !== activeConversationId) {
      setLoading(true);
      setActiveConversation(id);
      api.get(`/chat/conversations/${id}`)
        .then(({ data }) => setMessages(data.messages || []))
        .finally(() => setLoading(false));
    } else if (!id) {
      setActiveConversation(null);
      setMessages([]);
    }
    setReplyingTo(null);
  }, [id]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (isStreaming) scrollToBottom();
  }, [messages, isStreaming]);

  useEffect(() => {
    if (id) scrollToBottom('instant');
  }, [id]);

  // Show scroll-to-bottom button
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const msg = input;
    const replyId = replyingTo?.id ?? null;
    setInput('');
    setReplyingTo(null);

    if (isStreaming && chatModeEnabled) {
      // Chat Mode: add message to queue and show it in UI immediately
      const tempPendingMsg: Message = {
        id: `pending-${Date.now()}`,
        role: 'user',
        content: msg,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      addMessage(tempPendingMsg);
      enqueuePending(msg);
      scrollToBottom();
      return;
    }

    if (isStreaming) return;

    await sendMessage(msg, { replyToId: replyId });
    scrollToBottom();
  };

  // Add / change / remove a tapback reaction on a message.
  const handleReact = async (messageId: string, reaction: ReactionType | null) => {
    const convId = id || activeConversationId;
    if (!convId) return;
    // Reactions require a persisted message.
    if (messageId.startsWith('temp-') || messageId.startsWith('pending-')) return;

    const previous = messages.find(m => m.id === messageId)?.reaction ?? null;
    setMessageReaction(messageId, reaction); // optimistic
    try {
      await api.put(`/chat/conversations/${convId}/messages/${messageId}/reaction`, { reaction });
    } catch {
      setMessageReaction(messageId, previous); // revert on failure
    }
  };

  const activeConv = conversations.find(c => c.id === (id || activeConversationId));
  const messageById = new Map(messages.map(m => [m.id, m]));

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-xl transition-colors"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <Menu size={17} />
          </button>
        )}

        <div className="flex-1 min-w-0">
          {activeConv ? (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-1)' }}>
                {activeConv.title}
              </p>
              <ModelBadge modelId={activeConv.model as ModelId} size="xs" showName={false} />
            </div>
          ) : (
            <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>New chat</p>
          )}
        </div>
      </div>

      {/* Messages container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto"
      >
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="loader-dots">
              <span /><span /><span />
            </div>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState onSuggestion={text => setInput(text)} />
        ) : (
          <div className="py-4 max-w-3xl mx-auto w-full">
            {messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                chatModeEnabled={chatModeEnabled}
                replyTarget={m.replyToId ? messageById.get(m.replyToId) ?? null : null}
                onReact={(reaction) => handleReact(m.id, reaction)}
                onReply={() => setReplyingTo(m)}
              />
            ))}
            <div ref={messagesEndRef} className="h-6" />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 animate-fade-in">
          <button
            onClick={() => scrollToBottom()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium shadow-lg transition-all hover:scale-105"
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border-2)',
              color: 'var(--text-2)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <ChevronDown size={13} /> Scroll to bottom
          </button>
        </div>
      )}

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={stopStreaming}
        chatModeEnabled={chatModeEnabled}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
      />
    </div>
  );
};
