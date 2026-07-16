import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hljs from 'highlight.js/lib/common';
import TextareaAutosize from 'react-textarea-autosize';
import { Copy, Check, Reply, SmilePlus, RefreshCw, Pencil } from 'lucide-react';
import type { Message } from '../../store/chatStore';
import type { ModelId } from '../../lib/models';
import type { ReactionType } from '../../lib/reactions';
import { ModelBadge } from '../ui/ModelBadge';
import { Spark } from '../ui/Spark';
import { TapbackBadge, TapbackPicker } from './Tapback';

/* ── Code block with language label, syntax highlighting + copy ── */
const CodeBlock: React.FC<{ language?: string; children?: string }> = ({ language, children = '' }) => {
  const [copied, setCopied] = useState(false);

  const highlighted = useMemo(() => {
    try {
      if (language && hljs.getLanguage(language)) {
        return hljs.highlight(children, { language }).value;
      }
      return hljs.highlightAuto(children).value;
    } catch {
      return null;
    }
  }, [children, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span>{language || 'code'}</span>
        <button onClick={handleCopy} aria-label="Copy code">
          {copied ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>
      <pre>
        {highlighted !== null ? (
          <code className="hljs" dangerouslySetInnerHTML={{ __html: highlighted }} />
        ) : (
          <code>{children}</code>
        )}
      </pre>
    </div>
  );
};

const markdownComponents = {
  pre: ({ children }: { children?: React.ReactNode }) => {
    const child = React.Children.toArray(children)[0] as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
    const className = child?.props?.className ?? '';
    const lang = className.replace('language-', '') || '';
    const code = child?.props?.children ?? '';
    return <CodeBlock language={lang}>{String(code).replace(/\n$/, '')}</CodeBlock>;
  },
  code: (props: Record<string, unknown>) => {
    const { children, className } = props as { children?: React.ReactNode; className?: string };
    return <code className={className as string}>{children}</code>;
  },
};

/* ── Quoted preview of the message being replied to ── */
const ReplyPreview: React.FC<{ target: Message; align: 'left' | 'right' }> = ({ target, align }) => {
  const author = target.role === 'assistant' ? 'Max' : 'You';
  const snippet = target.content.replace(/\s+/g, ' ').trim().slice(0, 90);
  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'} mb-1 px-1`}>
      <div
        className="flex items-center gap-1.5 max-w-[75%] px-2.5 py-1 rounded-2xl text-[11px] truncate"
        style={{ background: 'var(--bg-3)', color: 'var(--text-3)' }}
      >
        <Reply size={10} className="shrink-0" />
        <span className="font-semibold shrink-0" style={{ color: 'var(--text-2)' }}>{author}</span>
        <span className="truncate">{snippet || '…'}</span>
      </div>
    </div>
  );
};

/* ── Hover action button ── */
const ActionButton: React.FC<{ title: string; onClick?: () => void; children: React.ReactNode }> = ({ title, onClick, children }) => (
  <button
    onClick={onClick}
    title={title}
    aria-label={title}
    className="p-1.5 rounded-lg transition-colors"
    style={{ color: 'var(--text-3)' }}
    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-3)')}
    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
  >
    {children}
  </button>
);

interface MessageBubbleProps {
  message: Message;
  chatModeEnabled?: boolean;
  replyTarget?: Message | null;
  firstInGroup?: boolean;
  tail?: boolean;
  isLastAssistant?: boolean;
  onReact?: (reaction: ReactionType | null) => void;
  onReply?: () => void;
  onRegenerate?: () => void;
  onEdit?: (content: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  chatModeEnabled = false,
  replyTarget = null,
  firstInGroup = true,
  tail = true,
  isLastAssistant = false,
  onReact,
  onReply,
  onRegenerate,
  onEdit,
}) => {
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePick = (reaction: ReactionType | null) => {
    onReact?.(reaction);
    setPickerOpen(false);
  };

  const startEdit = () => {
    setDraft(message.content);
    setEditing(true);
  };
  const saveEdit = () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== message.content) onEdit?.(trimmed);
  };

  const canReact = chatModeEnabled && !message.pending && !message.streaming;

  /* Reaction / reply actions available in Chat Mode. */
  const chatActions = canReact && (
    <div className="relative flex items-center">
      <ActionButton title="Reply" onClick={onReply}><Reply size={14} /></ActionButton>
      <ActionButton title="Tapback" onClick={() => setPickerOpen((v) => !v)}><SmilePlus size={14} /></ActionButton>
      {pickerOpen && (
        <div className={`absolute bottom-9 z-30 ${isUser ? 'right-0' : 'left-0'}`}>
          <TapbackPicker current={message.reaction} onPick={handlePick} onClose={() => setPickerOpen(false)} />
        </div>
      )}
    </div>
  );

  const timeLabel = new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  /* ── USER ── */
  if (isUser) {
    return (
      <div className={`flex flex-col px-4 ${firstInGroup ? 'mt-5' : 'mt-1'} ${tail ? 'mb-1' : ''} animate-msg`}>
        {replyTarget && <ReplyPreview target={replyTarget} align="right" />}
        <div className="flex justify-end">
          <div className="flex items-end gap-1.5 max-w-[82%] group">
            {/* Hover actions to the left of the bubble */}
            {!editing && (
              <div className="flex items-center self-center opacity-0 group-hover:opacity-100 transition-opacity">
                {!message.pending && !message.streaming && onEdit && (
                  <ActionButton title="Edit" onClick={startEdit}><Pencil size={13} /></ActionButton>
                )}
                <ActionButton title="Copy" onClick={handleCopy}>{copied ? <Check size={13} /> : <Copy size={13} />}</ActionButton>
                {chatActions}
              </div>
            )}

            {editing ? (
              <div className="w-[min(560px,80vw)] rounded-2xl p-2" style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)' }}>
                <TextareaAutosize
                  value={draft}
                  autoFocus
                  minRows={1}
                  maxRows={12}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="w-full px-2 py-1.5 text-[15px] resize-none focus:outline-none bg-transparent"
                  style={{ color: 'var(--text-1)' }}
                />
                <div className="flex items-center justify-end gap-2 mt-1">
                  <button onClick={() => setEditing(false)} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ color: 'var(--text-2)', background: 'var(--bg-3)' }}>Cancel</button>
                  <button onClick={saveEdit} className="px-3 py-1 rounded-lg text-xs font-semibold" style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}>Save &amp; send</button>
                </div>
              </div>
            ) : (
              <div className="relative pb-1">
                <div className="bubble bubble-user whitespace-pre-wrap">
                  {message.content}
                </div>
                {message.reaction && (
                  <TapbackBadge reaction={message.reaction} side="left" onClick={() => canReact && setPickerOpen(true)} />
                )}
              </div>
            )}
          </div>
        </div>
        {message.edited && !editing && (
          <div className="flex justify-end pr-1 mt-0.5">
            <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>Edited</span>
          </div>
        )}
      </div>
    );
  }

  /* ── ASSISTANT ── */
  const isThinking = message.streaming && !message.content;

  return (
    <div className={`flex flex-col px-4 ${firstInGroup ? 'mt-5' : 'mt-2'} ${tail ? 'mb-1' : ''} animate-msg`}>
      {replyTarget && (
        <div className="pl-10">
          <ReplyPreview target={replyTarget} align="left" />
        </div>
      )}
      <div className="flex justify-start gap-3">
        {/* Max avatar — only at the start of a group, otherwise a spacer keeps alignment */}
        <div className="w-7 shrink-0 flex justify-center pt-0.5">
          {firstInGroup && (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}
            >
              <Spark size={16} />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 group">
          <div className="relative inline-block max-w-full">
            {isThinking ? (
              <div className="typing-dots pt-1"><span /><span /><span /></div>
            ) : (
              <div className={`prose-max ${message.streaming ? 'typing-cursor' : ''}`}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents as never}>
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
            {message.reaction && (
              <TapbackBadge reaction={message.reaction} side="right" onClick={() => canReact && setPickerOpen(true)} />
            )}
          </div>

          {/* Meta line + hover actions on the tail message */}
          {!isThinking && !message.streaming && message.content && (
            <div className="flex items-center gap-1 mt-1.5 -ml-1.5">
              <ActionButton title="Copy" onClick={handleCopy}>{copied ? <Check size={13} /> : <Copy size={13} />}</ActionButton>
              {isLastAssistant && onRegenerate && (
                <ActionButton title="Regenerate" onClick={onRegenerate}><RefreshCw size={13} /></ActionButton>
              )}
              {chatActions}
              {tail && message.model && (
                <div className="flex items-center gap-2 ml-1.5">
                  <ModelBadge modelId={message.model as ModelId} size="xs" showName={false} />
                  <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{timeLabel}</span>
                  {message.tokens ? (
                    <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>· {message.tokens.toLocaleString()} tokens</span>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
