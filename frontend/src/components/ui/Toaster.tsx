import React from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useToastStore, type ToastKind } from '../../store/toastStore';

const ICONS: Record<ToastKind, React.ReactNode> = {
  error: <AlertCircle size={17} />,
  success: <CheckCircle2 size={17} />,
  info: <Info size={17} />,
};

const COLORS: Record<ToastKind, string> = {
  error: '#e5484d',
  success: '#30a46c',
  info: '#5b57e0',
};

export const Toaster: React.FC = () => {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast pointer-events-auto flex items-center gap-2.5 pl-3 pr-2 py-2.5 rounded-2xl glass min-w-[240px] max-w-[92vw]"
          style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}
          role="status"
        >
          <span style={{ color: COLORS[t.kind] }} className="shrink-0">
            {ICONS[t.kind]}
          </span>
          <span className="text-[13px] flex-1" style={{ color: 'var(--text-1)' }}>
            {t.message}
          </span>
          <button
            onClick={() => dismiss(t.id)}
            className="p-1 rounded-lg shrink-0"
            style={{ color: 'var(--text-3)' }}
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
