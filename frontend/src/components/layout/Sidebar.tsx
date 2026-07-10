import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pin, Trash2, Settings, ChevronLeft, Search,
  MoreHorizontal, PinOff, MessageSquarePlus, Sparkles
} from 'lucide-react';
import { useChatStore, type Conversation } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { ModelBadge } from '../ui/ModelBadge';
import type { ModelId } from '../../lib/models';
import api from '../../lib/api';
import { formatDistanceToNow, isToday, isYesterday, subDays, isAfter } from 'date-fns';
import { de } from 'date-fns/locale';

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
  today: 'Heute',
  yesterday: 'Gestern',
  week: 'Letzte 7 Tage',
  month: 'Letzter Monat',
  older: 'Älter',
};

export const Sidebar: React.FC<SidebarProps> = ({ onNewChat }) => {
  const { conversations, activeConversationId, setActiveConversation,
    removeConversation, updateConversation, sidebarOpen, setSidebarOpen } = useChatStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = () => setMenuId(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const pinned = filtered.filter(c => c.pinned);
  const unpinned = filtered.filter(c => !c.pinned);

  // Group unpinned by date
  const groups = (['today', 'yesterday', 'week', 'month', 'older'] as DateGroup[]).reduce(
    (acc, g) => {
      acc[g] = unpinned.filter(c => getDateGroup(new Date(c.updatedAt)) === g);
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
    await api.delete(`/chat/conversations/${id}`);
    removeConversation(id);
    if (activeConversationId === id) navigate('/chat');
    setMenuId(null);
  };

  const handlePin = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    await api.post(`/chat/conversations/${conv.id}/pin`);
    updateConversation(conv.id, { pinned: !conv.pinned });
    setMenuId(null);
  };

  const ConvItem = ({ conv }: { conv: Conversation }) => {
    const isActive = activeConversationId === conv.id;
    return (
      <div
        onClick={() => selectConv(conv.id)}
        className={`conv-item group ${isActive ? 'active' : ''}`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {conv.pinned && <Pin size={9} style={{ color: 'var(--text-3)' }} className="shrink-0" />}
            <p className="text-[13px] truncate" style={{ color: 'var(--text-1)', fontWeight: isActive ? 500 : 400 }}>
              {conv.title}
            </p>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <ModelBadge modelId={conv.model as ModelId} size="xs" showName={false} />
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
              {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true, locale: de })}
            </span>
          </div>
        </div>

        {/* Context menu button */}
        <div className="relative shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { e.stopPropagation(); setMenuId(menuId === conv.id ? null : conv.id); }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <MoreHorizontal size={13} />
          </button>

          {menuId === conv.id && (
            <div
              className="absolute right-0 top-6 z-50 w-44 rounded-xl overflow-hidden animate-scale-in"
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
            >
              <button
                onClick={e => handlePin(e, conv)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left"
                style={{ color: 'var(--text-1)' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                {conv.pinned ? <PinOff size={13} /> : <Pin size={13} />}
                {conv.pinned ? 'Lösen' : 'Anheften'}
              </button>
              <div style={{ height: '1px', background: 'var(--border)', margin: '2px 0' }} />
              <button
                onClick={e => handleDelete(e, conv.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors text-left text-red-500"
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
              >
                <Trash2 size={13} /> Löschen
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  /* ── Collapsed sidebar ── */
  if (!sidebarOpen) {
    return (
      <div
        className="flex flex-col items-center py-4 gap-3 w-14 h-full shrink-0"
        style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-2)' }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          title="Sidebar öffnen"
        >
          <ChevronLeft size={16} className="rotate-180" />
        </button>
        <button
          onClick={onNewChat}
          className="p-2 rounded-xl text-white shadow-sm"
          style={{ background: 'linear-gradient(135deg, #5B5BD6, #7C3AED)' }}
          title="Neuer Chat"
        >
          <Plus size={16} />
        </button>
      </div>
    );
  }

  /* ── Full sidebar ── */
  return (
    <div
      className="flex flex-col w-[260px] h-full shrink-0 animate-slide-left"
      style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-2)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 pt-4 pb-3">
        <div className="flex items-center gap-2 flex-1 min-w-0 px-1">
          <div
            className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #5B5BD6, #7C3AED)' }}
          >
            <span className="text-white text-[11px] font-bold">M</span>
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--text-1)' }}>maxAI</span>
        </div>
        <button
          onClick={onNewChat}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-2)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          title="Neuer Chat (Ctrl+K)"
        >
          <MessageSquarePlus size={16} />
        </button>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          title="Sidebar schließen"
        >
          <ChevronLeft size={15} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 mb-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="w-full pl-8 pr-3 py-2 rounded-xl text-[13px] focus:outline-none transition-colors"
            style={{
              background: 'var(--bg-3)',
              color: 'var(--text-1)',
              border: '1px solid transparent',
            }}
            onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)'}
            onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'transparent'}
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {filtered.length === 0 ? (
          <div className="text-center py-10">
            <Sparkles size={20} className="mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
            <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>
              {search ? 'Keine Ergebnisse' : 'Noch keine Chats'}
            </p>
          </div>
        ) : (
          <>
            {/* Pinned */}
            {pinned.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1" style={{ color: 'var(--text-3)' }}>
                  Angeheftet
                </p>
                {pinned.map(c => <ConvItem key={c.id} conv={c} />)}
              </div>
            )}

            {/* Grouped by date */}
            {(Object.entries(groups) as [DateGroup, Conversation[]][])
              .filter(([, items]) => items.length > 0)
              .map(([group, items]) => (
                <div key={group} className="mb-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest px-2 mb-1" style={{ color: 'var(--text-3)' }}>
                    {GROUP_LABELS[group]}
                  </p>
                  {items.map(c => <ConvItem key={c.id} conv={c} />)}
                </div>
              ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl transition-colors text-left"
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <Avatar name={user?.name || user?.email || '?'} color={user?.avatarColor} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-1)' }}>
              {user?.name || 'Einstellungen'}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-3)' }}>{user?.email}</p>
          </div>
          <Settings size={14} style={{ color: 'var(--text-3)' }} className="shrink-0" />
        </button>
      </div>
    </div>
  );
};
