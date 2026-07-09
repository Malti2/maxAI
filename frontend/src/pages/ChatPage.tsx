import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { MessageBubbleWrapper } from '../components/chat/MessageBubble';
import { ChatInput } from '../components/chat/ChatInput';
import { EmptyState } from '../components/chat/EmptyState';
import { useChatStore } from '../store/chatStore';
import { useChat } from '../hooks/useChat';
import api from '../lib/api';
import { Menu, Sparkles } from 'lucide-react';
import { ModelBadge } from '../components/ui/ModelBadge';
import { ModelId } from '../lib/models';

export const ChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const {
    messages, setMessages, activeConversationId, setActiveConversation,
    conversations, sidebarOpen, setSidebarOpen, isStreaming
  } = useChatStore();
  const { sendMessage, stopStreaming } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  // Load conversation messages
  useEffect(() => {
    if (id && id !== activeConversationId) {
      setLoading(true);
      setActiveConversation(id);
      api.get(`/chat/conversations/${id}`)
        .then(({ data }) => {
          setMessages(data.messages || []);
        })
        .finally(() => setLoading(false));
    } else if (!id) {
      setActiveConversation(null);
      setMessages([]);
    }
  }, [id]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isStreaming]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const msg = input;
    setInput('');
    await sendMessage(msg);
  };

  const activeConv = conversations.find(c => c.id === (id || activeConversationId));

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 shrink-0">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-400"
          >
            <Menu size={18} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          {activeConv ? (
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{activeConv.title}</p>
              <ModelBadge modelId={activeConv.model as ModelId} size="xs" showName={false} />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Neuer Chat</p>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        ) : messages.length === 0 ? (
          <EmptyState onSuggestion={(text) => { setInput(text); }} />
        ) : (
          <div className="py-4 max-w-3xl mx-auto w-full">
            {messages.map((m, i) => (
              <MessageBubbleWrapper key={m.id} message={m} isLast={i === messages.length - 1} />
            ))}
            <div ref={bottomRef} className="h-4" />
          </div>
        )}
      </div>

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
