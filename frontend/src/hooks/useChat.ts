import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore, type Message } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

export function useChat() {
  const {
    activeConversationId,
    selectedModel,
    setStreaming,
    addMessage,
    updateLastMessage,
    addConversation,
    setActiveConversation,
    updateConversation,
  } = useChatStore();
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();
  const abortRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    let convId = activeConversationId;

    // Create a new conversation if needed
    if (!convId) {
      const { data } = await api.post('/chat/conversations', { model: selectedModel });
      addConversation(data);
      setActiveConversation(data.id);
      convId = data.id;
      navigate(`/chat/${data.id}`, { replace: true });
    }

    setStreaming(true);

    // Optimistic user message
    const tempUserMsg: Message = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    addMessage(tempUserMsg);

    // Streaming assistant placeholder (empty = shows "thinking" dots)
    const tempAssistantId = `temp-assistant-${Date.now()}`;
    const tempAssistantMsg: Message = {
      id: tempAssistantId,
      role: 'assistant',
      content: '',
      streaming: true,
      createdAt: new Date().toISOString(),
    };
    addMessage(tempAssistantMsg);

    let aborted = false;

    try {
      const response = await fetch(`/api/chat/conversations/${convId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ content, model: selectedModel }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      abortRef.current = () => {
        aborted = true;
        reader.cancel();
      };

      let buffer = '';
      let realUserMsg: Message | null = null;
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'user_message') {
              realUserMsg = event.message as Message;
            } else if (event.type === 'delta') {
              accumulatedContent += event.content as string;
              updateLastMessage(accumulatedContent);
            } else if (event.type === 'done') {
              const realAssistantMsg: Message = { ...(event.message as Message), streaming: false };
              // Replace temp messages with real persisted ones
              const store = useChatStore.getState();
              const updated = store.messages
                .filter(m => m.id !== tempUserMsg.id && m.id !== tempAssistantId)
                .concat(realUserMsg ? [realUserMsg, realAssistantMsg] : [realAssistantMsg]);
              store.setMessages(updated);

              // Update conversation title
              updateConversation(convId!, {
                title: content.slice(0, 60) + (content.length > 60 ? '…' : ''),
                updatedAt: new Date().toISOString(),
              });
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    } catch (err) {
      if (!aborted) {
        updateLastMessage('⚠️ Fehler beim Laden der Antwort. Bitte versuche es erneut.');
        // Mark streaming as done on the last message
        const store = useChatStore.getState();
        const msgs = store.messages.map(m =>
          m.id === tempAssistantId ? { ...m, streaming: false } : m
        );
        store.setMessages(msgs);
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [activeConversationId, selectedModel, accessToken, navigate,
      addConversation, setActiveConversation, setStreaming,
      addMessage, updateLastMessage, updateConversation]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.();
    setStreaming(false);
    // Mark last message as no longer streaming
    const store = useChatStore.getState();
    const msgs = store.messages.map((m, i) =>
      i === store.messages.length - 1 ? { ...m, streaming: false } : m
    );
    store.setMessages(msgs);
  }, [setStreaming]);

  return { sendMessage, stopStreaming };
}
