import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { EmptyState } from '../components/chat/EmptyState';
import { useChatStore } from '../store/chatStore';
import { useChat } from '../hooks/useChat';
import api from '../lib/api';
import { Menu, ChevronDown } from 'lucide-react';
import { ModelBadge } from '../components/ui/ModelBadge';
import type { ModelId } from '../lib/models';

export const ChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    messages, setMessages, activeConversationId, setActiveConversation,
    conversations, sidebarOpen, setSidebarOpen, isStreaming
  } = useChatStore();
  const { sendMessage, stopStreaming } = useChat();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

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

  // Keyboard shortcut: Ctrl/Cmd+K = new chat (handled in AppLayout)
  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const msg = input;
    setInput('');
    await sendMessage(msg);
    scrollToBottom();
  };

  const activeConv = conversations.find(c => c.id === (id || activeConversationId));

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
            <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>Neuer Chat</p>
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
              <MessageBubble key={m.id} message={m} />
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
            <ChevronDown size={13} /> Nach unten
          </button>
        </div>
      )}

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={handleSend}
        onStop={stopStreaming}
      />
    </div>
  );
};
