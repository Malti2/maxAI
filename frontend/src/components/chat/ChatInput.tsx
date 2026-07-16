import React, { useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { ArrowUp, Square, Reply, X } from 'lucide-react';
import { ModelSelector } from '../ui/ModelSelector';
import { useChatStore, type Message } from '../../store/chatStore';
import type { ModelId } from '../../lib/models';
import api from '../../lib/api';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  chatModeEnabled?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  variant?: 'docked' | 'home';
  autoFocus?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value, onChange, onSend, onStop, chatModeEnabled, replyingTo, onCancelReply,
  variant = 'docked', autoFocus = true,
}) => {
  const { isStreaming, selectedModel, setSelectedModel } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isHome = variant === 'home';

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const syncModel = async (model: ModelId) => {
    const activeId = useChatStore.getState().activeConversationId;
    if (activeId) {
      try {
        await api.patch(`/chat/conversations/${activeId}`, { model });
        useChatStore.getState().updateConversation(activeId, { model });
      } catch { /* ignore sync failure */ }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const canSendNow = value.trim() && (!isStreaming || chatModeEnabled);
      if (canSendNow) {
        syncModel(selectedModel);
        onSend();
      }
    }
    if (e.key === 'Escape' && replyingTo) onCancelReply?.();
  };

  const canSend = value.trim().length > 0 && (!isStreaming || chatModeEnabled);
  const showStop = isStreaming && !chatModeEnabled;

  const replyAuthor = replyingTo?.role === 'assistant' ? 'Max' : 'yourself';
  const replySnippet = replyingTo?.content.replace(/\s+/g, ' ').trim().slice(0, 90);

  const composer = (
    <>
      {replyingTo && (
        <div
          className="flex items-center gap-2 px-3.5 py-2 mb-2 rounded-2xl text-xs animate-fade-in"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
        >
          <Reply size={13} style={{ color: 'var(--accent)' }} className="shrink-0" />
          <span className="shrink-0" style={{ color: 'var(--text-2)' }}>
            Replying to <span className="font-medium">{replyAuthor}</span>
          </span>
          <span className="truncate flex-1" style={{ color: 'var(--text-3)' }}>{replySnippet}</span>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-md shrink-0 transition-colors"
            style={{ color: 'var(--text-3)' }}
            aria-label="Cancel reply"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div
        className="relative rounded-[26px] transition-shadow"
        style={{
          background: 'var(--surface)',
          border: `1px solid ${isStreaming && chatModeEnabled ? 'var(--accent)' : 'var(--border-2)'}`,
          boxShadow: isHome ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
        }}
      >
        <TextareaAutosize
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isStreaming && chatModeEnabled
              ? 'Message will be queued…'
              : isHome ? 'Ask Max anything…' : 'Message Max…'
          }
          minRows={isHome ? 2 : 1}
          maxRows={12}
          className="w-full px-4.5 pt-3.5 pb-1 text-[15.5px] leading-relaxed resize-none focus:outline-none bg-transparent"
          style={{ color: 'var(--text-1)' }}
        />

        <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-0.5">
          <ModelSelector value={selectedModel} onChange={(m: ModelId) => setSelectedModel(m)} />

          {showStop ? (
            <button
              onClick={onStop}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0"
              style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }}
              aria-label="Stop generating"
            >
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={() => { syncModel(selectedModel); onSend(); }}
              disabled={!canSend}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0"
              style={canSend ? {
                background: 'var(--accent)',
                color: 'var(--accent-text)',
                transform: 'scale(1)',
              } : {
                background: 'var(--bg-3)',
                color: 'var(--text-3)',
                transform: 'scale(0.95)',
              }}
              aria-label="Send message"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
    </>
  );

  if (isHome) {
    return <div className="w-full">{composer}</div>;
  }

  return (
    <div className="px-4 pb-4 pt-1 shrink-0">
      <div className="max-w-3xl mx-auto">
        {composer}
        <p className="text-center text-[11px] mt-2.5" style={{ color: 'var(--text-3)' }}>
          Max can make mistakes. Please double-check important information.
        </p>
      </div>
    </div>
  );
};
