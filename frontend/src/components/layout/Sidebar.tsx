import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Pin, Trash2, Settings, PanelLeftClose, PanelLeft, Search,
  MoreHorizontal, PinOff, SquarePen, MessageSquare,
} from 'lucide-react';
import { useChatStore, type Conversation } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import { Avatar } from '../ui/Avatar';
import { Spark } from '../ui/Spark';
import api from '../../lib/api';
import { isToday, isYesterday, subDays, isAfter } from 'date-fns';

interface SidebarProps {
  onNewChat: () => void;
}

type DateGroup = 'today' | 'yesterday' | 'week' | 'month' | 'older';

function getDateGroup(date: Date): DateGroup {
  if (isToday(date)) return 'today';
  if (isYesterday(date)) return 'yesterday';
  if (isAfter(date, subDays(new Date(), 7))) return 'week';
  if (isAfter(date, subDays(new Date(), 30))) return 'month';
  return 'older';
}

const GROUP_LABELS: Record<DateGroup, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Previous 7 days',
  month: 'Previous 30 days',
  older: 'Older',
};

function shortTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isYesterday(date)) return 'Yesterday';
  if (isAfter(date, subDays(new Date(), 7))) return date.toLocaleDateString([], { weekday: 'short' });
  return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
}

export const Sidebar: React.FC<SidebarProps> = ({ onNewChat }) => {
  const {
    conversations, activeConversationId, setActiveConversation,
    removeConversation, updateConversation, sidebarOpen, setSidebarOpen,
  } = useChatStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handler = () => setMenuId(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = conversations.filter((c) =>
    (c.title + ' ' + (c.preview ?? '')).toLowerCase().includes(search.toLowerCase())
  );

  const pinned = filtered.filter((c) => c.pinned);
  const unpinned = filtered.filter((c) => !c.pinned);

  const groups = (['today', 'yesterday', 'week', 'month', 'older'] as DateGroup[]).reduce(
    (acc, g) => {
      acc[g] = unpinned.filter((c) => getDateGroup(new Date(c.updatedAt)) === g);
      return acc;
    },
    {} as Record<DateGroup, Conversation[]>
  );

  const selectConv = (id: string) => {
    setActiveConversation(id);
    navigate(`/chat/${id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setMenuId(null);
    try {
      await api.delete(`/chat/conversations/${id}`);
      removeConversation(id);
      if (activeConversationId === id) navigate('/chat');
    } catch {
      toast.error('Could not delete the conversation.');
    }
  };

  const handlePin = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setMenuId(null);
    updateConversation(conv.id, { pinned: !conv.pinned });
    try {
      await api.post(`/chat/conversations/${conv.id}/pin`);
    } catch {
      updateConversation(conv.id, { pinned: conv.pinned });
      toast.error('Could not update the pin.');
    }
  };

  const ConvItem = ({ conv }: { conv: Conversation }) => {
    const isActive = activeConversationId === conv.id;
    return (
      <div onClick={() => selectConv(conv.id)} className={`conv-item group ${isActive ? 'active' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {conv.pinned && <Pin size={10} style={{ color: 'var(--text-3)' }} className="shrink-0" />}
            <p
              className="text-[13.5px] truncate flex-1"
              style={{ color: isActive ? 'var(--text-1)' : 'var(--text-2)', fontWeight: isActive ? 600 : 500 }}
            >
              {conv.title}
            </p>
            <span className="text-[10.5px] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-3)' }}>
              {shortTime(conv.updatedAt)}
            </span>
          </div>
        </div>

        <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuId(menuId === conv.id ? null : conv.id); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all"
            style={{ color: 'var(--text-3)' }}
            aria-label="Conversation options"
          >
            <MoreHorizontal size={15} />
          </button>

          {menuId === conv.id && (
            <div
              className="absolute right-0 top-6 z-50 w-44 rounded-xl overflow-hidden animate-scale-in glass"
              style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
            >
              <button
                onClick={(e) => handlePin(e, conv)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left"
                style={{ color: 'var(--text-1)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-3)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                {conv.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                {conv.pinned ? 'Unpin' : 'Pin'}
              </button>
              <div style={{ height: '1px', background: 'var(--border)' }} />
              <button
                onClick={(e) => handleDelete(e, conv.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left"
                style={{ color: 'var(--danger)' }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--danger) 10%, transparent)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── Collapsed ── */
  if (!sidebarOpen) {
    return (
      <div
        className="flex flex-col items-center py-4 gap-2 w-14 h-full shrink-0"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-2)' }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--text-2)' }}
          aria-label="Open sidebar"
        >
          <PanelLeft size={19} />
        </button>
        <button
          onClick={onNewChat}
          className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-105"
          style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
          aria-label="New chat"
          title="New chat (⌘K)"
        >
          <SquarePen size={16} />
        </button>
      </div>
    );
  }

  /* ── Full ── */
  return (
    <div
      className="flex flex-col w-[272px] h-full shrink-0 animate-slide-left"
      style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-2)' }}
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Spark size={22} />
          <span className="display text-[19px]" style={{ color: 'var(--text-1)' }}>maxAI</span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-3)' }}
          aria-label="Close sidebar"
          title="Collapse sidebar (⌘B)"
        >
          <PanelLeftClose size={17} />
        </button>
      </div>

      <div className="px-3 pt-1 pb-1">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-all"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-1)', boxShadow: 'var(--shadow-sm)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
        >
          <SquarePen size={16} style={{ color: 'var(--accent)' }} />
          New chat
        </button>
      </div>

      <div className="px-3 mb-1.5 mt-1">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats"
            className="w-full pl-9 pr-3 py-2 rounded-xl text-[13px] focus:outline-none transition-colors"
            style={{ background: 'var(--bg-3)', color: 'var(--text-1)', border: '1px solid transparent' }}
            onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)')}
            onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'transparent')}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 px-4">
            <MessageSquare size={22} className="mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
            <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
              {search ? 'No results' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <>
            {pinned.length > 0 && (
              <div className="mb-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider px-2.5 mb-1" style={{ color: 'var(--text-3)' }}>
                  Pinned
                </p>
                {pinned.map((c) => <ConvItem key={c.id} conv={c} />)}
              </div>
            )}
            {(Object.entries(groups) as [DateGroup, Conversation[]][])
              .filter(([, items]) => items.length > 0)
              .map(([group, items]) => (
                <div key={group} className="mb-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider px-2.5 mb-1" style={{ color: 'var(--text-3)' }}>
                    {GROUP_LABELS[group]}
                  </p>
                  {items.map((c) => <ConvItem key={c.id} conv={c} />)}
                </div>
              ))}
          </>
        )}
      </div>

      <div className="p-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-colors text-left"
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-3)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <Avatar name={user?.name || user?.email || '?'} color={user?.avatarColor} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-1)' }}>
              {user?.name || 'Settings'}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-3)' }}>{user?.email}</p>
          </div>
          <Settings size={15} style={{ color: 'var(--text-3)' }} className="shrink-0" />
        </button>
      </div>
    </div>
  );
};
