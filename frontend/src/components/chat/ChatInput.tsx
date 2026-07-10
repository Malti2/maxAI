import React, { useRef, useEffect } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { ArrowUp, Square } from 'lucide-react';
import { ModelSelector } from '../ui/ModelSelector';
import { useChatStore } from '../../store/chatStore';
import type { ModelId } from '../../lib/models';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  chatModeEnabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ value, onChange, onSend, onStop, chatModeEnabled }) => {
  const { isStreaming, selectedModel, setSelectedModel } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const canSendNow = value.trim() && (!isStreaming || chatModeEnabled);
      if (canSendNow) onSend();
    }
  };

  // In Chat Mode, allow sending while streaming
  const canSend = value.trim().length > 0 && (!isStreaming || chatModeEnabled);

  return (
    <div className="px-4 pb-5 pt-2 shrink-0">
      <div className="max-w-3xl mx-auto">
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
              : 'Schreibe eine Nachricht…  (⇧↵ für neue Zeile)'
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
                  Stopp
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
          Max kann Fehler machen. Wichtige Informationen bitte überprüfen.
        </p>
      </div>
    </div>
  );
};
