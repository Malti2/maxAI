import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore, Message } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

export function useChat() {
  const {
    activeConversationId, selectedModel, setStreaming,
    addMessage, updateLastMessage, setMessages, addConversation,
    setActiveConversation, updateConversation, messages,
  } = useChatStore();
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();
  const abortRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Create conversation if none active
    let convId = activeConversationId;
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
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };
    addMessage(tempUserMsg);

    // Streaming assistant placeholder
    const tempAssistantMsg: Message = {
      id: `temp-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      streaming: true,
      createdAt: new Date().toISOString(),
    };
    addMessage(tempAssistantMsg);

    let assistantContent = '';
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

      if (!response.ok) {
        throw new Error('API error');
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      abortRef.current = () => {
        aborted = true;
        reader.cancel();
      };

      let buffer = '';
      let realUserMsg: Message | null = null;
      let resolvedModel: string | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done || aborted) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));

            if (event.type === 'user_message') {
              realUserMsg = event.message;
            } else if (event.type === 'model') {
              resolvedModel = event.model;
            } else if (event.type === 'delta') {
              assistantContent += event.content;
              updateLastMessage(assistantContent);
            } else if (event.type === 'done') {
              // Replace temp messages with real ones
              const realAssistantMsg: Message = {
                ...event.message,
                streaming: false,
              };
              useChatStore.getState().setMessages(
                useChatStore.getState().messages
                  .filter(m => m.id !== tempUserMsg.id && m.id !== tempAssistantMsg.id)
                  .concat(realUserMsg ? [realUserMsg, realAssistantMsg] : [realAssistantMsg])
              );
              // Update conversation title if first message
              updateConversation(convId!, {
                title: content.slice(0, 60) + (content.length > 60 ? '…' : ''),
                updatedAt: new Date().toISOString(),
              });
            }
          } catch (e) {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      if (!aborted) {
        updateLastMessage('Fehler beim Laden der Antwort. Bitte versuche es erneut.');
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [activeConversationId, selectedModel, accessToken]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.();
    setStreaming(false);
  }, []);

  return { sendMessage, stopStreaming };
}
