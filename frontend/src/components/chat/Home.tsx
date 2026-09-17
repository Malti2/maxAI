import React, { useMemo } from 'react';
import { PenLine, Code2, GraduationCap, Lightbulb } from 'lucide-react';
import { ChatInput } from './ChatInput';
import { Spark } from '../ui/Spark';
import { useAuthStore } from '../../store/authStore';
import type { Message } from '../../store/chatStore';
import { getGreeting } from '../../lib/greeting';

const SUGGESTIONS = [
  { icon: PenLine, label: 'Write', detail: 'Draft a clear, friendly email', prompt: 'Help me draft a clear, friendly email to reschedule a meeting.' },
  { icon: Code2, label: 'Code', detail: 'Explain a technical concept', prompt: 'Explain the difference between async/await and Promises, with a short example.' },
  { icon: GraduationCap, label: 'Learn', detail: 'Understand something new', prompt: 'Explain how HTTPS keeps a connection secure, in plain language.' },
  { icon: Lightbulb, label: 'Brainstorm', detail: 'Explore ideas and directions', prompt: 'Give me five creative names for a productivity app and why each works.' },
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
    <main className="home-shell">
      <div className="home-content">
        <div className="home-heading animate-fade-up">
          <Spark size={30} className="home-mark" />
          <h1>{greeting.hero}</h1>
          <p>{greeting.subline}</p>
        </div>

        <div className="animate-fade-up" style={{ animationDelay: '50ms' }}>
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

        <div className="suggestion-grid animate-fade-up" style={{ animationDelay: '90ms' }}>
          {SUGGESTIONS.map(({ icon: Icon, label, detail, prompt }) => (
            <button key={label} onClick={() => setInput(prompt)} className="suggestion-card">
              <Icon size={16} />
              <span><strong>{label}</strong><small>{detail}</small></span>
            </button>
          ))}
        </div>
      </div>
      <p className="home-disclaimer">Max can make mistakes. Check important information.</p>
    </main>
  );
};
