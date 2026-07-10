import React from 'react';
import { MODELS } from '../../lib/models';
import { useAuthStore } from '../../store/authStore';

const SUGGESTION_GROUPS = [
  {
    icon: '✍️',
    label: 'Write',
    items: ['Draft a professional email', 'Write a blog post about AI'],
  },
  {
    icon: '💻',
    label: 'Code',
    items: ['Debug my Python code', 'Explain an algorithm'],
  },
  {
    icon: '🧠',
    label: 'Analyze',
    items: ['Analyze this text', 'Summarize a topic'],
  },
  {
    icon: '💡',
    label: 'Ideas',
    items: ['Brainstorm for a project', 'Give me creative ideas'],
  },
];

interface EmptyStateProps {
  onSuggestion: (text: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSuggestion }) => {
  const { user } = useAuthStore();

  const hour = new Date().getHours();
  const timeGreeting =
    hour < 5  ? 'Good night' :
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
    hour < 21 ? 'Good evening' : 'Good night';

  const firstName = user?.name?.split(' ')[0];
  const greeting = firstName ? `${timeGreeting}, ${firstName}` : `${timeGreeting}`;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-6 overflow-y-auto">
      {/* Hero */}
      <div className="text-center mb-10 animate-fade-up">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg"
          style={{ background: 'linear-gradient(135deg, #5B5BD6, #7C3AED)' }}
        >
          <span className="text-white text-xl font-bold">M</span>
        </div>
        <h1 className="text-3xl font-semibold mb-2 gradient-text" style={{ letterSpacing: '-0.02em' }}>
          {greeting} 👋
        </h1>
        <p className="text-base" style={{ color: 'var(--text-2)' }}>
          How can I help you today?
        </p>
      </div>

      {/* Model pills */}
      <div className="flex items-center gap-2 flex-wrap justify-center mb-8 animate-fade-up" style={{ animationDelay: '60ms' }}>
        {MODELS.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: `${m.color}12`,
              color: m.color,
              border: `1px solid ${m.color}28`,
            }}
          >
            <span className="text-[11px]">{m.icon}</span>
            <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{m.name}</span>
            <span style={{ color: m.color, fontWeight: 600 }}>{m.badge}</span>
          </div>
        ))}
      </div>

      {/* Suggestion grid */}
      <div
        className="grid grid-cols-2 gap-2.5 w-full max-w-2xl animate-fade-up"
        style={{ animationDelay: '120ms' }}
      >
        {SUGGESTION_GROUPS.map((group) =>
          group.items.map((item, i) => (
            <button
              key={item}
              onClick={() => onSuggestion(item)}
              className="flex items-start gap-3 text-left px-4 py-3.5 rounded-2xl border transition-all hover:scale-[1.01] active:scale-[0.99]"
              style={{
                background: 'var(--bg-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-2)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)';
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)';
              }}
            >
              {i === 0 && (
                <span className="text-base leading-none mt-0.5 shrink-0">{group.icon}</span>
              )}
              {i !== 0 && <span className="w-5 shrink-0" />}
              <div className="min-w-0">
                {i === 0 && (
                  <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {group.label}
                  </p>
                )}
                <p className="text-sm leading-snug">{item}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
