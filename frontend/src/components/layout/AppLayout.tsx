import React, { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ShortcutsModal } from '../ui/ShortcutsModal';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import { toast } from '../../store/toastStore';
import type { ModelId } from '../../lib/models';
import api from '../../lib/api';

export const AppLayout: React.FC = () => {
  const {
    setConversations, setActiveConversation, setMessages, setSelectedModel,
    setSidebarOpen,
  } = useChatStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    api.get('/chat/conversations')
      .then(({ data }) => setConversations(data))
      .catch(() => toast.error('Could not load your conversations.'));

    if (user?.defaultModel) setSelectedModel(user.defaultModel as ModelId);
  }, []);

  const handleNewChat = () => {
    setActiveConversation(null);
    setMessages([]);
    navigate('/chat');
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
      } else if (meta && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarOpen(!useChatStore.getState().sidebarOpen);
      } else if (meta && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar onNewChat={handleNewChat} />
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
};
