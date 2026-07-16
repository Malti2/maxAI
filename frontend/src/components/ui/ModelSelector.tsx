import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { MODELS, type ModelId, getModel } from '../../lib/models';

interface ModelSelectorProps {
  value: ModelId;
  onChange: (model: ModelId) => void;
  align?: 'left' | 'right';
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange, align = 'left' }) => {
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
        className="flex items-center gap-1.5 h-8 pl-2 pr-2 rounded-full text-[13px] font-medium transition-colors"
        style={{ color: 'var(--text-2)' }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-3)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        title={`${model.name} ${model.badge}`}
        aria-label={`Model: ${model.name} ${model.badge}`}
      >
        <span className="text-[14px] leading-none" style={{ color: model.color }}>{model.icon}</span>
        <span>{model.name} {model.badge}</span>
        <ChevronDown size={14} style={{ color: 'var(--text-3)' }} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className={`absolute bottom-full mb-2 z-50 w-72 rounded-2xl overflow-hidden animate-scale-in glass ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
        >
          <div className="px-3 pt-2.5 pb-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>
              Choose a model
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
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0"
                  style={{ background: `${m.color}1f`, color: m.color }}
                >
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{m.name} {m.badge}</span>
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
