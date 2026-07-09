import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { MODELS, ModelId, getModel } from '../../lib/models';
import { useChatStore } from '../../store/chatStore';

interface ModelSelectorProps {
  value: ModelId;
  onChange: (model: ModelId) => void;
  compact?: boolean;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange, compact = false }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const model = getModel(value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        <span className="text-gray-500 dark:text-gray-400">{model.name}</span>
        <span
          className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
          style={{ background: `${model.color}20`, color: model.color }}
        >
          {model.badge}
        </span>
        <ChevronDown size={14} className={`opacity-50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-50 w-72 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700/50 bg-white dark:bg-gray-900 overflow-hidden scale-in">
          <div className="p-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { onChange(m.id); setOpen(false); }}
                className={`w-full flex items-start gap-3 p-3 rounded-xl transition-colors text-left ${
                  value === m.id
                    ? 'bg-black/5 dark:bg-white/5'
                    : 'hover:bg-black/3 dark:hover:bg-white/3'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-base shrink-0 mt-0.5"
                  style={{ background: `${m.color}20`, color: m.color }}
                >
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{m.name}</span>
                    <span
                      className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: `${m.color}20`, color: m.color }}
                    >
                      {m.badge}
                    </span>
                    {value === m.id && (
                      <span className="ml-auto">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-500">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{m.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
