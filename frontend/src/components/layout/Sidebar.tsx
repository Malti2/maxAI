import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, MessageSquare, Pin, Trash2, Settings, ChevronLeft,
  Search, MoreHorizontal, PinOff
} from 'lucide-react';
import { useChatStore, Conversation } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { Avatar } from '../ui/Avatar';
import { ModelBadge } from '../ui/ModelBadge';
import { ModelId } from '../../lib/models';
import api from '../../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { de } from 'date-fns/locale';

interface SidebarProps {
  onNewChat: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onNewChat }) => {
  const { conversations, activeConversationId, setActiveConversation, removeConversation,
    updateConversation, sidebarOpen, setSidebarOpen } = useChatStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const pinned = filtered.filter(c => c.pinned);
  const unpinned = filtered.filter(c => !c.pinned);

  const selectConversation = (id: string) => {
    setActiveConversation(id);
    navigate(`/chat/${id}`);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await api.delete(`/chat/conversations/${id}`);
    removeConversation(id);
    if (activeConversationId === id) {
      navigate('/chat');
    }
    setMenuOpen(null);
  };

  const handlePin = async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    await api.post(`/chat/conversations/${conv.id}/pin`);
    updateConversation(conv.id, { pinned: !conv.pinned });
    setMenuOpen(null);
  };

  const ConvItem = ({ conv }: { conv: Conversation }) => (
    <div
      key={conv.id}
      onClick={() => selectConversation(conv.id)}
      className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
        activeConversationId === conv.id
          ? 'bg-black/8 dark:bg-white/8'
          : 'hover:bg-black/4 dark:hover:bg-white/4'
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {conv.pinned && <Pin size={10} className="text-gray-400 shrink-0" />}
          <p className="text-sm text-gray-700 dark:text-gray-200 truncate">{conv.title}</p>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <ModelBadge modelId={conv.model as ModelId} size="xs" showName={false} />
          <span className="text-[11px] text-gray-400">
            {formatDistanceToNow(new Date(conv.updatedAt), { addSuffix: true, locale: de })}
          </span>
        </div>
      </div>

      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === conv.id ? null : conv.id); }}
          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all"
        >
          <MoreHorizontal size={14} className="text-gray-400" />
        </button>

        {menuOpen === conv.id && (
          <div className="absolute right-0 top-6 z-50 w-44 rounded-xl shadow-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden scale-in">
            <button
              onClick={(e) => handlePin(e, conv)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5"
            >
              {conv.pinned ? <PinOff size={14} /> : <Pin size={14} />}
              {conv.pinned ? 'Lösen' : 'Anheften'}
            </button>
            <button
              onClick={(e) => handleDelete(e, conv.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <Trash2 size={14} /> Löschen
            </button>
          </div>
        )}
      </div>
    </div>
  );

  if (!sidebarOpen) {
    return (
      <div className="flex flex-col items-center py-4 gap-3 w-16 h-full border-r border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-900/80">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-400"
        >
          <ChevronLeft size={18} className="rotate-180" />
        </button>
        <button
          onClick={onNewChat}
          className="p-2 rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm"
        >
          <Plus size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-64 h-full bg-gray-50/80 dark:bg-gray-900/80 border-r border-gray-100 dark:border-gray-800">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <span className="text-white text-xs font-bold">M</span>
          </div>
          <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Max</span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 text-gray-400"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* New chat button */}
      <div className="px-3 mb-2">
        <button
          onClick={onNewChat}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors shadow-sm"
        >
          <Plus size={16} />
          Neuer Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-3 mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Suchen…"
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-black/5 dark:bg-white/5 text-sm text-gray-700 dark:text-gray-300 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {pinned.length > 0 && (
          <div className="mb-2">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">Angeheftet</p>
            {pinned.map(conv => <ConvItem key={conv.id} conv={conv} />)}
          </div>
        )}
        {unpinned.length > 0 && (
          <div>
            {pinned.length > 0 && (
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1 mt-3">Letzte</p>
            )}
            {unpinned.map(conv => <ConvItem key={conv.id} conv={conv} />)}
          </div>
        )}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            {search ? 'Keine Ergebnisse' : 'Noch keine Chats'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-100 dark:border-gray-800 p-3">
        <button
          onClick={() => navigate('/settings')}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
        >
          <Avatar name={user?.name || user?.email || '?'} color={user?.avatarColor} size="sm" />
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{user?.name || 'Einstellungen'}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
          <Settings size={14} className="text-gray-400 shrink-0" />
        </button>
      </div>
    </div>
  );
};
