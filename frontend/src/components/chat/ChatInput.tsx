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

  // Focus the field when a reply is started.
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const canSendNow = value.trim() && (!isStreaming || chatModeEnabled);
      if (canSendNow) onSend();
    }
    if (e.key === 'Escape' && replyingTo) {
      onCancelReply?.();
    }
  };

  // In Chat Mode, allow sending while streaming
  const canSend = value.trim().length > 0 && (!isStreaming || chatModeEnabled);

  const replyAuthor = replyingTo?.role === 'assistant' ? 'Max' : 'yourself';
  const replySnippet = replyingTo?.content.replace(/\s+/g, ' ').trim().slice(0, 90);

  return (
    <div className="px-4 pb-5 pt-2 shrink-0">
      <div className="max-w-3xl mx-auto">
        {/* Reply banner */}
        {replyingTo && (
          <div
            className="flex items-center gap-2 px-3 py-2 mb-1.5 rounded-xl text-xs animate-fade-in"
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
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <X size={13} />
            </button>
          </div>
        )}

        <div
          className="input-box relative rounded-2xl border overflow-hidden"
          style={{
            background: 'var(--bg)',
            borderColor: isStreaming && chatModeEnabled ? 'var(--accent)' : 'var(--border-2)',
            boxShadow: 'var(--shadow-lg)',
            transition: 'border-color 0.2s',
          }}
        >
          <TextareaAutosize
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming && chatModeEnabled
              ? 'Message will be queued…'
              : 'Type a message…  (⇧↵ for a new line)'
            }
            minRows={1}
            maxRows={12}
            className="w-full px-4 pt-3.5 pb-12 text-[15px] leading-relaxed resize-none focus:outline-none"
            style={{
              background: 'transparent',
              color: 'var(--text-1)',
            }}
          />

          {/* Bottom bar */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2.5 border-t"
            style={{ borderColor: 'var(--border)', background: 'var(--bg-2)' }}
          >
            <ModelSelector value={selectedModel} onChange={(m: ModelId) => setSelectedModel(m)} />

            <div className="flex items-center gap-2.5">
              {value.length > 50 && (
                <span className="text-xs tabular-nums" style={{ color: 'var(--text-3)' }}>
                  {value.length}
                </span>
              )}

              {isStreaming && !chatModeEnabled ? (
                <button
                  onClick={onStop}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-xl border transition-colors"
                  style={{
                    background: 'var(--bg-3)',
                    borderColor: 'var(--border-2)',
                    color: 'var(--text-2)',
                  }}
                >
                  <Square size={12} fill="currentColor" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={onSend}
                  disabled={!canSend}
                  className="w-8 h-8 rounded-xl flex items-center justify-center font-medium transition-all"
                  style={canSend ? {
                    background: 'linear-gradient(135deg, #5B5BD6, #7C3AED)',
                    color: 'white',
                    boxShadow: '0 2px 8px rgba(99,102,241,0.35)',
                  } : {
                    background: 'var(--bg-3)',
                    color: 'var(--text-3)',
                  }}
                >
                  <ArrowUp size={15} strokeWidth={2.5} />
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
