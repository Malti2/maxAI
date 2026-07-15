import React, { useRef, useEffect } from 'react';
import { REACTIONS, getReaction, type ReactionType } from '../../lib/reactions';

/* ── Badge showing the tapback attached to a message ──
   Rendered as a small circular bubble overlapping the corner of the message.
   `side` is where it sits relative to the bubble. */
interface TapbackBadgeProps {
  reaction: string;
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
      aria-label={`Tapback: ${config.label}`}
      className="absolute -top-3 flex items-center justify-center w-7 h-7 rounded-full text-[13px] shadow-sm transition-transform hover:scale-110 animate-scale-in"
      style={{
        background: 'var(--bubble-in)',
        border: '2px solid var(--bg)',
        [side]: '-10px',
      } as React.CSSProperties}
    >
      {config.emoji}
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
      className="flex items-center gap-0.5 p-1.5 rounded-full animate-scale-in glass"
      style={{ border: '1px solid var(--border-2)', boxShadow: 'var(--shadow-lg)' }}
    >
      {REACTIONS.map((r) => {
        const active = current === r.id;
        return (
          <button
            key={r.id}
            onClick={() => onPick(active ? null : r.id)}
            title={r.label}
            aria-label={r.label}
            className="w-8 h-8 flex items-center justify-center rounded-full text-base transition-all hover:scale-125"
            style={{ background: active ? 'var(--accent-dim)' : 'transparent' }}
          >
            {r.emoji}
          </button>
        );
      })}
    </div>
  );
};
