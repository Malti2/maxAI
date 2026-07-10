import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, RefreshCw, ChevronDown } from 'lucide-react';
import type { Message } from '../../store/chatStore';
import type { ModelId } from '../../lib/models';
import { getModel } from '../../lib/models';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { ModelBadge } from '../ui/ModelBadge';

/* ── Code block with language label + copy ── */
interface CodeBlockProps {
  language?: string;
  children?: string;
}

const CodeBlock: React.FC<CodeBlockProps> = ({ language, children = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span>{language || 'code'}</span>
        <button onClick={handleCopy}>
          {copied ? <><Check size={11} /> Kopiert</> : <><Copy size={11} /> Kopieren</>}
        </button>
      </div>
      <pre><code>{children}</code></pre>
    </div>
  );
};

/* ── Custom renderer map ── */
const createComponents = () => ({
  pre: ({ children }: { children?: React.ReactNode }) => {
    const child = React.Children.toArray(children)[0] as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    const className = child?.props?.className ?? '';
    const lang = className.replace('language-', '') || '';
    const code = child?.props?.children ?? '';
    return <CodeBlock language={lang}>{String(code).replace(/\n$/, '')}</CodeBlock>;
  },
  code: (props: Record<string, unknown>) => {
    const { inline, children, className } = props as { inline?: boolean; children?: React.ReactNode; className?: string };
    if (inline) {
      return <code className={className as string}>{children}</code>;
    }
    return <code>{children}</code>;
  },
});

/* ── Main component ── */
interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const components = createComponents();

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-1.5 animate-fade-up">
        <div className="flex items-end gap-2.5 max-w-[80%]">
          <div className="group relative">
            <div
              className="px-4 py-3 rounded-2xl rounded-br-md text-white text-sm leading-relaxed"
              style={{ background: 'linear-gradient(135deg, #5B5BD6 0%, #7C3AED 100%)' }}
            >
              {message.content}
            </div>
            {/* Copy on hover */}
            <button
              onClick={handleCopy}
              className="absolute -bottom-5 right-0 opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 px-1.5 py-0.5 rounded transition-all"
            >
              {copied ? <Check size={10} /> : <Copy size={10} />}
            </button>
          </div>
          <Avatar name={user?.name || user?.email || '?'} color={user?.avatarColor} size="xs" />
        </div>
      </div>
    );
  }

  /* ── Assistant message ── */
  const isThinking = message.streaming && !message.content;

  return (
    <div className="flex gap-3 px-4 py-2 animate-fade-up group">
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
          <span className="text-white text-xs font-bold tracking-tight">M</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--text-1)' }}>Max</span>
          {message.model && (
            <ModelBadge modelId={message.model as ModelId} size="xs" showName={false} />
          )}
        </div>

        {/* Thinking state */}
        {isThinking ? (
          <div className="flex items-center gap-1.5 py-1">
            <div className="loader-dots">
              <span /><span /><span />
            </div>
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Denkt…</span>
          </div>
        ) : (
          <div className={`prose-max ${message.streaming ? 'typing-cursor' : ''}`}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components as any}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Actions (shown on hover after streaming) */}
        {!message.streaming && message.content && (
          <div className="flex items-center gap-1 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              style={{ color: 'var(--text-3)' }}
            >
              {copied ? <><Check size={12} /> Kopiert</> : <><Copy size={12} /> Kopieren</>}
            </button>
            {message.tokens && (
              <span className="text-xs px-2 py-1" style={{ color: 'var(--text-3)' }}>
                {message.tokens.toLocaleString()} Tokens
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
