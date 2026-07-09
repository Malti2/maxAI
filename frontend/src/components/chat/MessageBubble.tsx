import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';
import { Message } from '../../store/chatStore';
import { Avatar } from '../ui/Avatar';
import { ModelBadge } from '../ui/ModelBadge';
import { ModelId } from '../../lib/models';
import { useAuthStore } from '../../store/authStore';

interface MessageBubbleProps {
  message: Message;
  isLast?: boolean;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isLast }) => {
  const { user } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex items-end justify-end gap-3 px-4 py-2 fade-in-up">
        <div className="max-w-[75%] group">
          <div className="bg-indigo-500 text-white rounded-3xl rounded-br-lg px-4 py-3 text-sm leading-relaxed shadow-sm">
            {message.content}
          </div>
        </div>
        <Avatar
          name={user?.name || user?.email || '?'}
          color={user?.avatarColor}
          size="sm"
        />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 px-4 py-2 fade-in-up">
      <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
        <span className="text-white text-xs font-bold">M</span>
      </div>

      <div className="flex-1 min-w-0 max-w-[85%]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Max</span>
          {message.model && (
            <ModelBadge modelId={message.model as ModelId} size="xs" showName={false} />
          )}
        </div>

        <div className={`prose-max text-gray-800 dark:text-gray-100 text-sm ${message.streaming ? 'typing-cursor' : ''}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {message.content || (message.streaming ? '' : '')}
          </ReactMarkdown>
        </div>

        {!message.streaming && message.content && (
          <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Kopiert' : 'Kopieren'}
            </button>
            {message.tokens && (
              <span className="text-xs text-gray-300 dark:text-gray-600">{message.tokens} Token</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Wrap in group for hover effect
export const MessageBubbleWrapper: React.FC<MessageBubbleProps> = (props) => (
  <div className="group">
    <MessageBubble {...props} />
  </div>
);
