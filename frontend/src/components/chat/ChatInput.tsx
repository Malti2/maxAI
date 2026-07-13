import React, { useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { ArrowUp, Square, Reply, X } from 'lucide-react';
import { ModelSelector } from '../ui/ModelSelector';
import { useChatStore, type Message } from '../../store/chatStore';
import type { ModelId } from '../../lib/models';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  chatModeEnabled?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value, onChange, onSend, onStop, chatModeEnabled, replyingTo, onCancelReply,
}) => {
  const { isStreaming, selectedModel, setSelectedModel } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const canSendNow = value.trim() && (!isStreaming || chatModeEnabled);
      if (canSendNow) onSend();
    }
    if (e.key === 'Escape' && replyingTo) onCancelReply?.();
  };

  const canSend = value.trim().length > 0 && (!isStreaming || chatModeEnabled);
  const showStop = isStreaming && !chatModeEnabled;

  const replyAuthor = replyingTo?.role === 'assistant' ? 'Max' : 'yourself';
  const replySnippet = replyingTo?.content.replace(/\s+/g, ' ').trim().slice(0, 90);

  return (
    <div className="px-4 pb-4 pt-1 shrink-0">
      <div className="max-w-3xl mx-auto">
        {replyingTo && (
          <div
            className="flex items-center gap-2 px-3 py-2 mb-2 rounded-2xl text-xs animate-fade-in"
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

        <div className="flex items-end gap-2">
          {/* Model selector (like the iMessage attachment button) */}
          <div className="pb-1">
            <ModelSelector value={selectedModel} onChange={(m: ModelId) => setSelectedModel(m)} />
          </div>

          {/* Input pill */}
          <div
            className="input-box relative flex-1 rounded-[22px] border"
            style={{
              background: 'var(--bg)',
              borderColor: isStreaming && chatModeEnabled ? 'var(--accent)' : 'var(--border-2)',
              transition: 'border-color 0.2s',
            }}
          >
            <TextareaAutosize
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isStreaming && chatModeEnabled ? 'Message will be queued…' : 'Message Max…'}
              minRows={1}
              maxRows={12}
              className="w-full pl-4 pr-12 py-2.5 text-[15px] leading-relaxed resize-none focus:outline-none bg-transparent"
              style={{ color: 'var(--text-1)' }}
            />

            <div className="absolute right-1.5 bottom-1.5">
              {showStop ? (
                <button
                  onClick={onStop}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }}
                  aria-label="Stop generating"
                >
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={onSend}
                  disabled={!canSend}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                  style={canSend ? {
                    background: 'var(--accent)',
                    color: 'white',
                    transform: 'scale(1)',
                  } : {
                    background: 'var(--bg-3)',
                    color: 'var(--text-3)',
                    transform: 'scale(0.94)',
                  }}
                  aria-label="Send message"
                >
                  <ArrowUp size={17} strokeWidth={2.6} />
                </button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] mt-2" style={{ color: 'var(--text-3)' }}>
          Max can make mistakes. Please double-check important information.
        </p>
      </div>
    </div>
  );
};
