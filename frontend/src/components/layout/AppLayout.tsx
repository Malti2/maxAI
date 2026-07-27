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
    setSidebarOpen, setWebSearch, setWebSearchAvailable,
  } = useChatStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useEffect(() => {
    api.get('/chat/conversations')
      .then(({ data }) => setConversations(data))
      .catch(() => toast.error('Could not load your conversations.'));
  }, [setConversations]);

  // Features the operator has switched off should not show up as toggles.
  useEffect(() => {
    api.get('/settings/capabilities')
      .then(({ data }) => setWebSearchAvailable(!!data.webSearch))
      .catch(() => { /* keep the default and let the request fail loudly instead */ });
  }, [setWebSearchAvailable]);

  useEffect(() => {
    if (user?.defaultModel) setSelectedModel(user.defaultModel as ModelId);
  }, [user?.defaultModel, setSelectedModel]);

  // The stored web-search preference seeds the composer toggle.
  useEffect(() => {
    setWebSearch(!!user?.webSearch);
  }, [user?.webSearch, setWebSearch]);

  const handleNewChat = React.useCallback(() => {
    setActiveConversation(null);
    setMessages([]);
    navigate('/chat');
  }, [setActiveConversation, setMessages, navigate]);

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
      } else if (meta && e.key === ',') {
        e.preventDefault();
        navigate('/settings');
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handleNewChat, setSidebarOpen, navigate]);

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
