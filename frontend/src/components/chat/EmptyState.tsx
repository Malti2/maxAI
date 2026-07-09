import React from 'react';
import { MODELS, ModelId } from '../../lib/models';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';

const SUGGESTIONS = [
  'Erkläre mir Quantencomputing in einfachen Worten',
  'Schreibe ein Python-Skript zum Sortieren einer Liste',
  'Was sind die Unterschiede zwischen React und Vue?',
  'Hilf mir, eine E-Mail professionell zu formulieren',
];

interface EmptyStateProps {
  onSuggestion: (text: string) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onSuggestion }) => {
  const { user } = useAuthStore();
  const { selectedModel } = useChatStore();

  const greeting = user?.name ? `Hallo, ${user.name.split(' ')[0]}` : 'Hallo';

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8">
      <div className="text-center mb-8 fade-in-up">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-indigo-500/20">
          <span className="text-white text-2xl font-bold">M</span>
        </div>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white mb-2">
          {greeting} 👋
        </h1>
        <p className="text-gray-400 dark:text-gray-500 text-base">
          Wie kann ich dir heute helfen?
        </p>
      </div>

      {/* Model pills */}
      <div className="flex items-center gap-2 flex-wrap justify-center mb-8 fade-in-up" style={{ animationDelay: '0.1s' }}>
        {MODELS.map(m => (
          <div
            key={m.id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all"
            style={{
              background: `${m.color}10`,
              borderColor: `${m.color}30`,
              color: m.color,
            }}
          >
            <span>{m.icon}</span>
            <span className="text-gray-600 dark:text-gray-400">{m.name}</span>
            <span style={{ color: m.color }}>{m.badge}</span>
          </div>
        ))}
      </div>

      {/* Suggestions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl w-full fade-in-up" style={{ animationDelay: '0.2s' }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="text-left px-4 py-3 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-sm text-gray-600 dark:text-gray-400 transition-all duration-150 hover:shadow-sm"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
};
