import React, { useState, useRef, useEffect } from 'react';
import { Check } from 'lucide-react';
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
        className="w-9 h-9 rounded-full flex items-center justify-center text-base transition-transform hover:scale-105 active:scale-95"
        style={{ background: `${model.color}1f`, color: model.color, border: `1px solid ${model.color}33` }}
        title={`${model.name} ${model.badge}`}
        aria-label={`Model: ${model.name} ${model.badge}`}
      >
        {model.icon}
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 left-0 z-50 w-72 rounded-2xl overflow-hidden animate-scale-in glass"
          style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
        >
          <div className="px-3 pt-2.5 pb-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Model
            </p>
          </div>
          <div className="p-1.5 pt-0">
            {MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { onChange(m.id); setOpen(false); }}
                className="w-full flex items-start gap-3 p-2.5 rounded-xl transition-colors text-left"
                style={{ background: value === m.id ? 'var(--bg-3)' : 'transparent' }}
                onMouseEnter={(e) => { if (value !== m.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'; }}
                onMouseLeave={(e) => { if (value !== m.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                  style={{ background: `${m.color}1f`, color: m.color }}
                >
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{m.name}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: `${m.color}22`, color: m.color }}>
                      {m.badge}
                    </span>
                    {value === m.id && <Check size={13} className="ml-auto shrink-0" style={{ color: 'var(--accent)' }} />}
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
