import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { MODELS, type ModelId, getModel } from '../../lib/models';

interface ModelSelectorProps {
  value: ModelId;
  onChange: (model: ModelId) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange }) => {
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
        className="flex items-center gap-1.5 pl-2.5 pr-2 py-1.5 rounded-xl text-sm font-medium transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        style={{ color: 'var(--text-2)' }}
      >
        <span
          className="w-5 h-5 rounded-md flex items-center justify-center text-[11px] shrink-0"
          style={{ background: `${model.color}18`, color: model.color }}
        >
          {model.icon}
        </span>
        <span style={{ color: 'var(--text-2)' }}>{model.name}</span>
        <span
          className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold"
          style={{ background: `${model.color}18`, color: model.color }}
        >
          {model.badge}
        </span>
        <ChevronDown
          size={13}
          style={{ color: 'var(--text-3)' }}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 z-50 w-72 rounded-2xl overflow-hidden animate-scale-in"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          <div className="p-1.5">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { onChange(m.id); setOpen(false); }}
                className="w-full flex items-start gap-3 p-3 rounded-xl transition-colors text-left"
                style={{
                  background: value === m.id ? 'var(--bg-3)' : 'transparent',
                }}
                onMouseEnter={e => {
                  if (value !== m.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)';
                }}
                onMouseLeave={e => {
                  if (value !== m.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
                  style={{ background: `${m.color}15`, color: m.color }}
                >
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{m.name}</span>
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: `${m.color}18`, color: m.color }}
                    >
                      {m.badge}
                    </span>
                    {value === m.id && (
                      <Check size={13} className="ml-auto shrink-0" style={{ color: 'var(--accent)' }} />
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{m.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
