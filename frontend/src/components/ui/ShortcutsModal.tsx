import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['⌘', 'K'], label: 'New chat' },
  { keys: ['⌘', 'B'], label: 'Toggle sidebar' },
  { keys: ['⌘', '/'], label: 'Show keyboard shortcuts' },
  { keys: ['↵'], label: 'Send message' },
  { keys: ['⇧', '↵'], label: 'New line' },
  { keys: ['Esc'], label: 'Cancel reply / close' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-fade-in"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden animate-scale-in glass"
        style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>Keyboard shortcuts</h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--text-3)' }} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <div className="p-3">
          {SHORTCUTS.map((s) => (
            <div key={s.label} className="flex items-center justify-between px-2 py-2.5">
              <span className="text-[13px]" style={{ color: 'var(--text-2)' }}>{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="min-w-[24px] h-6 px-1.5 flex items-center justify-center rounded-md text-[12px] font-medium"
                    style={{ background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid var(--border-2)' }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
