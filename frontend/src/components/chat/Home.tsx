import React, { useMemo } from 'react';
import { PenLine, Code2, GraduationCap, Lightbulb, Sparkles } from 'lucide-react';
import { ChatInput } from './ChatInput';
import { Spark } from '../ui/Spark';
import { useAuthStore } from '../../store/authStore';
import type { Message } from '../../store/chatStore';
import { getGreeting } from '../../lib/greeting';

const SUGGESTIONS = [
  { icon: PenLine, label: 'Write', prompt: 'Help me draft a clear, friendly email to reschedule a meeting.' },
  { icon: Code2, label: 'Code', prompt: 'Explain the difference between async/await and Promises, with a short example.' },
  { icon: GraduationCap, label: 'Learn', prompt: 'Explain how HTTPS keeps a connection secure, in plain language.' },
  { icon: Lightbulb, label: 'Brainstorm', prompt: 'Give me five creative names for a productivity app and why each works.' },
];

interface HomeProps {
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onStop?: () => void;
  chatModeEnabled?: boolean;
  replyingTo?: Message | null;
  onCancelReply?: () => void;
}

export const Home: React.FC<HomeProps> = ({
  input, setInput, onSend, onStop, chatModeEnabled, replyingTo, onCancelReply,
}) => {
  const { user } = useAuthStore();
  const greeting = useMemo(() => getGreeting(user?.name), [user?.name]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-10 min-h-full">
      <div className="w-full max-w-2xl mx-auto">
        <div className="flex flex-col items-center text-center mb-8">
          <div className="mb-5 animate-fade-up" style={{ animation: 'spark-pulse 4s ease-in-out infinite' }}>
            <Spark size={40} />
          </div>
          <h1
            className="display text-[34px] sm:text-[40px] leading-tight text-balance animate-fade-up"
            style={{ color: 'var(--text-1)' }}
          >
            {greeting.hero}
          </h1>
          <p
            className="text-[15px] mt-3 max-w-md text-balance animate-fade-up"
            style={{ color: 'var(--text-2)', animationDelay: '60ms' }}
          >
            {greeting.subline}
          </p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
          <ChatInput
            value={input}
            onChange={setInput}
            onSend={onSend}
            onStop={onStop}
            chatModeEnabled={chatModeEnabled}
            replyingTo={replyingTo}
            onCancelReply={onCancelReply}
            variant="home"
          />
        </div>

        <div
          className="flex flex-wrap items-center justify-center gap-2 mt-5 animate-fade-up"
          style={{ animationDelay: '180ms' }}
        >
          {SUGGESTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.label}
                onClick={() => setInput(s.prompt)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-full text-[13px] font-medium transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-3)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-2)')}
              >
                <Icon size={15} style={{ color: 'var(--accent)' }} />
                {s.label}
              </button>
            );
          })}
        </div>

        <p className="text-center text-[11px] mt-8 flex items-center justify-center gap-1.5" style={{ color: 'var(--text-3)' }}>
          <Sparkles size={11} />
          Max can make mistakes. Please double-check important information.
        </p>
      </div>
    </div>
  );
};
