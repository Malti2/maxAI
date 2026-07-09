import React, { useRef, useCallback } from 'react';
import TextareaAutosize from 'react-textarea-autosize';
import { ArrowUp, Square, Paperclip } from 'lucide-react';
import { ModelSelector } from '../ui/ModelSelector';
import { useChatStore } from '../../store/chatStore';
import { ModelId } from '../../lib/models';

interface ChatInputProps {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({ value, onChange, onSend, onStop }) => {
  const { isStreaming, selectedModel, setSelectedModel } = useChatStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isStreaming && value.trim()) onSend();
    }
  };

  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <div className="px-4 pb-4 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="relative rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg hover:shadow-xl transition-shadow duration-200 overflow-hidden">
          <TextareaAutosize
            ref={textareaRef}
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Schreibe eine Nachricht…"
            minRows={1}
            maxRows={10}
            className="w-full px-5 pt-4 pb-14 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 bg-transparent resize-none focus:outline-none leading-relaxed"
          />

          {/* Bottom bar */}
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1">
              <ModelSelector
                value={selectedModel}
                onChange={(m: ModelId) => setSelectedModel(m)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300 dark:text-gray-600">
                {value.length > 0 ? `${value.length} Zeichen` : 'Enter zum Senden'}
              </span>
              {isStreaming ? (
                <button
                  onClick={onStop}
                  className="w-9 h-9 rounded-2xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 flex items-center justify-center hover:bg-gray-700 dark:hover:bg-gray-200 transition-colors shadow-sm"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={onSend}
                  disabled={!canSend}
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center transition-all shadow-sm ${
                    canSend
                      ? 'bg-indigo-500 hover:bg-indigo-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed'
                  }`}
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-gray-300 dark:text-gray-700 mt-2">
          Max kann Fehler machen. Wichtige Informationen bitte überprüfen.
        </p>
      </div>
    </div>
  );
};
