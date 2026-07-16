import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PanelLeft, ChevronDown, SquarePen } from 'lucide-react';
import { MessageBubble } from '../components/chat/MessageBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { Home } from '../components/chat/Home';
import { useChatStore, type Message } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { useChat } from '../hooks/useChat';
import { toast } from '../store/toastStore';
import { playTapback } from '../lib/sounds';
import api from '../lib/api';
import { ModelBadge } from '../components/ui/ModelBadge';
import type { ModelId } from '../lib/models';
import type { ReactionType } from '../lib/reactions';

const GROUP_GAP_MS = 8 * 60 * 1000; // new bubble group after 8 min of silence
const SEPARATOR_GAP_MS = 60 * 60 * 1000; // show a time separator after 1 h

function formatSeparator(date: Date): string {
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const sameDay = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const withinWeek = now.getTime() - date.getTime() < 7 * 24 * 60 * 60 * 1000;

  if (sameDay) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  if (withinWeek) return `${date.toLocaleDateString([], { weekday: 'long' })} ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

const DateSeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex justify-center my-4">
    <span className="text-[11px] font-medium px-2" style={{ color: 'var(--text-3)' }}>
      {label}
    </span>
  </div>
);

export const ChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    messages, setMessages, activeConversationId, setActiveConversation,
    conversations, sidebarOpen, setSidebarOpen, isStreaming,
    enqueuePending, addMessage, setMessageReaction,
  } = useChatStore();
  const { user } = useAuthStore();
  const { sendMessage, regenerate, editMessage, stopStreaming } = useChat();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const chatModeEnabled = user?.chatMode ?? false;

  useEffect(() => {
    if (id && id !== activeConversationId) {
      setLoading(true);
      setActiveConversation(id);
      api.get(`/chat/conversations/${id}`)
        .then(({ data }) => setMessages(data.messages || []))
        .catch(() => toast.error('Could not load this conversation.'))
        .finally(() => setLoading(false));
    } else if (!id) {
      setActiveConversation(null);
      setMessages([]);
    }
    setReplyingTo(null);
  }, [id, activeConversationId, setActiveConversation, setMessages]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (isStreaming) scrollToBottom();
  }, [messages, isStreaming, scrollToBottom]);

  useEffect(() => {
    if (id) scrollToBottom('instant');
  }, [id, scrollToBottom]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 240);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    const msg = input;
    const replyId = replyingTo?.id ?? null;
    setInput('');
    setReplyingTo(null);

    if (isStreaming && chatModeEnabled) {
      addMessage({
        id: `pending-${Date.now()}`,
        role: 'user',
        content: msg,
        createdAt: new Date().toISOString(),
        pending: true,
      });
      enqueuePending(msg);
      scrollToBottom();
      return;
    }

    if (isStreaming) return;
    await sendMessage(msg, { replyToId: replyId });
    scrollToBottom();
  };

  const handleReact = async (messageId: string, reaction: ReactionType | null) => {
    const convId = id || activeConversationId;
    if (!convId) return;
    if (messageId.startsWith('temp-') || messageId.startsWith('pending-')) return;

    const previous = messages.find((m) => m.id === messageId)?.reaction ?? null;
    setMessageReaction(messageId, reaction); // optimistic
    if (reaction) playTapback();
    try {
      await api.put(`/chat/conversations/${convId}/messages/${messageId}/reaction`, { reaction });
    } catch {
      setMessageReaction(messageId, previous);
      toast.error('Could not save your reaction.');
    }
  };

  const activeConv = conversations.find((c) => c.id === (id || activeConversationId));
  const messageById = new Map(messages.map((m) => [m.id, m]));
  const isHome = !loading && messages.length === 0;

  const newChat = () => {
    setActiveConversation(null);
    setMessages([]);
    setInput('');
    navigate('/chat');
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      {/* Slim top bar */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 shrink-0 z-10"
        style={{ minHeight: '52px', borderBottom: isHome ? '1px solid transparent' : '1px solid var(--border)' }}
      >
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-3)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            aria-label="Open sidebar"
          >
            <PanelLeft size={18} />
          </button>
        )}

        <div className="flex-1 min-w-0 flex items-center gap-2">
          {!isHome && activeConv?.title && activeConv.title !== 'New conversation' && (
            <span className="text-[14px] font-medium truncate" style={{ color: 'var(--text-1)' }}>
              {activeConv.title}
            </span>
          )}
          {!isHome && activeConv && <ModelBadge modelId={activeConv.model as ModelId} size="xs" showName={false} />}
        </div>

        {!isHome && (
          <button
            onClick={newChat}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-3)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
            aria-label="New chat"
            title="New chat (⌘K)"
          >
            <SquarePen size={17} />
          </button>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="loader-dots"><span /><span /><span /></div>
        </div>
      ) : isHome ? (
        <div ref={containerRef} className="flex-1 overflow-y-auto">
          <Home
            input={input}
            setInput={setInput}
            onSend={handleSend}
            onStop={stopStreaming}
            chatModeEnabled={chatModeEnabled}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </div>
      ) : (
        <>
          <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
            <div className="py-4 max-w-3xl mx-auto w-full">
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const next = messages[i + 1];
                const prevTime = prev ? new Date(prev.createdAt).getTime() : 0;
                const curTime = new Date(m.createdAt).getTime();
                const nextTime = next ? new Date(next.createdAt).getTime() : 0;

                const firstInGroup = !prev || prev.role !== m.role || curTime - prevTime > GROUP_GAP_MS;
                const tail = !next || next.role !== m.role || nextTime - curTime > GROUP_GAP_MS;
                const showSeparator = !prev || curTime - prevTime > SEPARATOR_GAP_MS;

                const isLast = i === messages.length - 1;
                const isLastAssistant = isLast && m.role === 'assistant' && !m.streaming;

                return (
                  <React.Fragment key={m.id}>
                    {showSeparator && <DateSeparator label={formatSeparator(new Date(m.createdAt))} />}
                    <MessageBubble
                      message={m}
                      chatModeEnabled={chatModeEnabled}
                      replyTarget={m.replyToId ? messageById.get(m.replyToId) ?? null : null}
                      firstInGroup={firstInGroup}
                      tail={tail}
                      isLastAssistant={isLastAssistant}
                      onReact={(reaction) => handleReact(m.id, reaction)}
                      onReply={() => setReplyingTo(m)}
                      onRegenerate={regenerate}
                      onEdit={(content) => editMessage(m.id, content)}
                    />
                  </React.Fragment>
                );
              })}
              <div ref={messagesEndRef} className="h-4" />
            </div>
          </div>

          {/* Scroll to bottom */}
          {showScrollBtn && (
            <div className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 animate-fade-in">
              <button
                onClick={() => scrollToBottom()}
                className="flex items-center justify-center w-9 h-9 rounded-full transition-all hover:scale-105 glass"
                style={{ border: '1px solid var(--border-2)', color: 'var(--text-1)', boxShadow: 'var(--shadow)' }}
                aria-label="Scroll to bottom"
              >
                <ChevronDown size={18} />
              </button>
            </div>
          )}

          <ChatInput
            value={input}
            onChange={setInput}
            onSend={handleSend}
            onStop={stopStreaming}
            chatModeEnabled={chatModeEnabled}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </>
      )}
    </div>
  );
};
