import React, { useRef, useEffect } from 'react';
import { REACTIONS, getReaction, type ReactionType } from '../../lib/reactions';

/* ── Small badge showing the reaction attached to a message ── */
interface TapbackBadgeProps {
  reaction: string;
  // "left" for user messages (bubble on the right), "right" for assistant.
  side: 'left' | 'right';
  onClick?: () => void;
}

export const TapbackBadge: React.FC<TapbackBadgeProps> = ({ reaction, side, onClick }) => {
  const config = getReaction(reaction);
  if (!config) return null;
  return (
    <button
      onClick={onClick}
      title={config.label}
      className="absolute -bottom-3 flex items-center justify-center w-6 h-6 rounded-full text-[11px] shadow-sm transition-transform hover:scale-110 animate-scale-in"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border-2)',
        [side]: '-6px',
      } as React.CSSProperties}
    >
      {config.emoji}
    </button>
  );
};

/* ── Inline reaction chip (used under assistant messages, which have no bubble) ── */
interface InlineReactionProps {
  reaction: string;
  onClick?: () => void;
}

export const InlineReaction: React.FC<InlineReactionProps> = ({ reaction, onClick }) => {
  const config = getReaction(reaction);
  if (!config) return null;
  return (
    <button
      onClick={onClick}
      title={config.label}
      className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[11px] transition-transform hover:scale-105 animate-scale-in"
      style={{ background: 'var(--bg-3)', border: '1px solid var(--border-2)', color: 'var(--text-2)' }}
    >
      <span className="text-[13px] leading-none">{config.emoji}</span>
    </button>
  );
};

/* ── Picker popover for choosing / toggling a tapback ── */
interface TapbackPickerProps {
  current?: string | null;
  onPick: (reaction: ReactionType | null) => void;
  onClose: () => void;
}

export const TapbackPicker: React.FC<TapbackPickerProps> = ({ current, onPick, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="flex items-center gap-0.5 p-1 rounded-full animate-scale-in"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border-2)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {REACTIONS.map(r => {
        const active = current === r.id;
        return (
          <button
            key={r.id}
            onClick={() => onPick(active ? null : r.id)}
            title={r.label}
            className="w-7 h-7 flex items-center justify-center rounded-full text-sm transition-all hover:scale-125"
            style={{ background: active ? 'var(--accent-dim)' : 'transparent' }}
          >
            {r.emoji}
          </button>
        );
      })}
    </div>
  );
};
