import React from 'react';
import { PenLine, Code2, Brain, Lightbulb } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const SUGGESTIONS = [
  { icon: PenLine, label: 'Write', color: '#0a84ff', prompt: 'Draft a friendly but professional email to reschedule a meeting.' },
  { icon: Code2, label: 'Code', color: '#5e5ce6', prompt: 'Explain the difference between async/await and Promises with an example.' },
  { icon: Brain, label: 'Analyze', color: '#30d158', prompt: 'Summarize the key trade-offs between SQL and NoSQL databases.' },
  { icon: Lightbulb, label: 'Ideas', color: '#ff9f0a', prompt: 'Give me five creative names for a productivity app and why they work.' },
];

interface EmptyStateProps {
  onSuggestion: (text: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSuggestion }) => {
  const { user } = useAuthStore();

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 5 ? 'Good night' :
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
    hour < 21 ? 'Good evening' : 'Good night';

  const firstName = user?.name?.split(' ')[0];
  const greeting = firstName ? `${timeGreeting}, ${firstName}` : timeGreeting;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6 min-h-full">
      <div className="text-center mb-9 animate-fade-up">
        <div
          className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-5 brand-gradient"
          style={{ boxShadow: '0 12px 40px rgba(10,132,255,0.35)' }}
        >
          <span className="text-white text-2xl font-bold">M</span>
        </div>
        <h1 className="text-[28px] font-bold mb-1.5 gradient-text tracking-tight">{greeting}</h1>
        <p className="text-[15px]" style={{ color: 'var(--text-2)' }}>
          What can I help you with today?
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 w-full max-w-lg animate-fade-up" style={{ animationDelay: '80ms' }}>
        {SUGGESTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.label}
              onClick={() => onSuggestion(s.prompt)}
              className="flex flex-col gap-2.5 text-left p-4 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: 'var(--bg-2)', borderColor: 'var(--border)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-3)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-2)')}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: `${s.color}1f`, color: s.color }}
              >
                <Icon size={18} />
              </div>
              <div>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>{s.label}</p>
                <p className="text-[12px] leading-snug mt-0.5" style={{ color: 'var(--text-3)' }}>{s.prompt}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
