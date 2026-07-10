import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

export const AppLayout: React.FC = () => {
  const { setConversations, setActiveConversation, setMessages, setSelectedModel } = useChatStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/chat/conversations').then(({ data }) => {
      setConversations(data);
    }).catch(() => {});

    if (user?.defaultModel) {
      setSelectedModel(user.defaultModel as any);
    }
  }, []);

  // Keyboard shortcut: Ctrl/Cmd+K = new chat
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const handleNewChat = () => {
    setActiveConversation(null);
    setMessages([]);
    navigate('/chat');
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <Sidebar onNewChat={handleNewChat} />
      <main className="flex-1 overflow-hidden relative">
        <Outlet />
      </main>
    </div>
  );
};
