import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useChatStore } from '../../store/chatStore';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

export const AppLayout: React.FC = () => {
  const { setConversations, sidebarOpen, addConversation, setActiveConversation, setMessages, setSelectedModel } = useChatStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Load conversations on mount
    api.get('/chat/conversations').then(({ data }) => {
      setConversations(data);
    }).catch(() => {});

    // Apply default model from user settings
    if (user?.defaultModel) {
      setSelectedModel(user.defaultModel as any);
    }
  }, []);

  const handleNewChat = () => {
    setActiveConversation(null);
    setMessages([]);
    navigate('/chat');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-gray-950">
      <Sidebar onNewChat={handleNewChat} />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
};
