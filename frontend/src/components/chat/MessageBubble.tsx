import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, Reply, SmilePlus } from 'lucide-react';
import type { Message } from '../../store/chatStore';
import type { ModelId } from '../../lib/models';
import type { ReactionType } from '../../lib/reactions';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { ModelBadge } from '../ui/ModelBadge';
import { TapbackBadge, TapbackPicker, InlineReaction } from './Tapback';

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
          {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
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

/* ── Quoted preview of the message being replied to ── */
interface ReplyPreviewProps {
  target: Message;
  align: 'left' | 'right';
}

const ReplyPreview: React.FC<ReplyPreviewProps> = ({ target, align }) => {
  const author = target.role === 'assistant' ? 'Max' : 'You';
  const snippet = target.content.replace(/\s+/g, ' ').trim().slice(0, 100);
  return (
    <div
      className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'} mb-1`}
    >
      <div
        className="flex items-center gap-1.5 max-w-[75%] px-2.5 py-1 rounded-lg text-[11px] truncate"
        style={{ background: 'var(--bg-3)', color: 'var(--text-3)', borderLeft: '2px solid var(--border-2)' }}
      >
        <Reply size={10} className="shrink-0" />
        <span className="font-medium shrink-0" style={{ color: 'var(--text-2)' }}>{author}:</span>
        <span className="truncate">{snippet || '…'}</span>
      </div>
    </div>
  );
};

/* ── Main component ── */
interface MessageBubbleProps {
  message: Message;
  chatModeEnabled?: boolean;
  replyTarget?: Message | null;
  onReact?: (reaction: ReactionType | null) => void;
  onReply?: () => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message, chatModeEnabled = false, replyTarget = null, onReact, onReply,
}) => {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isUser = message.role === 'user';
  const components = createComponents();

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePick = (reaction: ReactionType | null) => {
    onReact?.(reaction);
    setPickerOpen(false);
  };

  /* Reusable hover action buttons (reply + tapback), Chat Mode only. */
  const ChatActions = () => {
    if (!chatModeEnabled || message.pending) return null;
    return (
      <div className="relative flex items-center gap-0.5">
        <button
          onClick={onReply}
          title="Reply"
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <Reply size={13} />
        </button>
        <button
          onClick={() => setPickerOpen(v => !v)}
          title="Add tapback"
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <SmilePlus size={13} />
        </button>
        {pickerOpen && (
          <div className={`absolute bottom-8 z-30 ${isUser ? 'right-0' : 'left-0'}`}>
            <TapbackPicker current={message.reaction} onPick={handlePick} onClose={() => setPickerOpen(false)} />
          </div>
        )}
      </div>
    );
  };

  if (isUser) {
    return (
      <div className="flex flex-col px-4 py-1.5 animate-fade-up">
        {replyTarget && <ReplyPreview target={replyTarget} align="right" />}
        <div className="flex justify-end">
          <div className="flex items-end gap-2.5 max-w-[80%] group">
            {/* Hover actions to the left of the bubble */}
            <div className="flex items-center self-center opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                title="Copy"
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-3)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <ChatActions />
            </div>

            <div className="relative mb-2">
              <div
                className="px-4 py-3 rounded-2xl rounded-br-md text-white text-sm leading-relaxed whitespace-pre-wrap"
                style={{ background: 'linear-gradient(135deg, #5B5BD6 0%, #7C3AED 100%)' }}
              >
                {message.content}
              </div>
              {message.reaction && (
                <TapbackBadge reaction={message.reaction} side="left" onClick={() => chatModeEnabled && setPickerOpen(true)} />
              )}
            </div>
            <Avatar name={user?.name || user?.email || '?'} color={user?.avatarColor} size="xs" />
          </div>
        </div>
      </div>
    );
  }

  /* ── Assistant message ── */
  const isThinking = message.streaming && !message.content;

  return (
    <div className="flex flex-col px-4 py-2 animate-fade-up">
      {replyTarget && (
        <div className="pl-10">
          <ReplyPreview target={replyTarget} align="left" />
        </div>
      )}
      <div className="flex gap-3 group">
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
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Thinking…</span>
            </div>
          ) : (
            <>
              <div className={`prose-max ${message.streaming ? 'typing-cursor' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={components as any}>
                  {message.content}
                </ReactMarkdown>
              </div>
              {message.reaction && (
                <InlineReaction reaction={message.reaction} onClick={() => chatModeEnabled && setPickerOpen(true)} />
              )}
            </>
          )}

          {/* Actions (shown on hover after streaming) */}
          {!message.streaming && message.content && (
            <div className="flex items-center gap-1 mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                style={{ color: 'var(--text-3)' }}
              >
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
              </button>
              <ChatActions />
              {message.tokens && (
                <span className="text-xs px-2 py-1" style={{ color: 'var(--text-3)' }}>
                  {message.tokens.toLocaleString()} tokens
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
