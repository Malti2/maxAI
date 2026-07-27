import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore, type Message, type WebSource } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { playSend, playReceive } from '../lib/sounds';
import api from '../lib/api';

interface SendOptions {
  replyToId?: string | null;
}

interface StreamOptions {
  url: string;
  method: 'POST' | 'PUT';
  body: Record<string, unknown>;
  convId: string;
  // Temp message ids that should be replaced by their persisted counterparts.
  tempIds: string[];
  assistantTempId: string;
  // Set the conversation title from this text if it is the first exchange.
  titleSeed?: string | null;
}

export function useChat() {
  const {
    activeConversationId,
    selectedModel,
    setStreaming,
    addMessage,
    addConversation,
    setActiveConversation,
    setMessages,
    updateConversation,
    clearPendingQueue,
    setSearchState,
    addSessionTokens,
  } = useChatStore();
  const { accessToken } = useAuthStore();
  const navigate = useNavigate();
  const abortRef = useRef<(() => void) | null>(null);

  // ── Core SSE consumer, shared by send / regenerate / edit ──────────
  const runStream = useCallback(
    async (opts: StreamOptions) => {
      const { url, method, body, convId, tempIds, assistantTempId, titleSeed } = opts;
      setStreaming(true);

      let aborted = false;
      let receivedFirstDelta = false;

      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        abortRef.current = () => {
          aborted = true;
          reader.cancel().catch(() => {});
        };

        let buffer = '';
        let realUserMsg: Message | null = null;
        let realPendingMsgs: Message[] = [];
        let aiReaction: { messageId: string; reaction: string } | null = null;
        let sources: WebSource[] | null = null;
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done || aborted) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            let event: Record<string, unknown>;
            try {
              event = JSON.parse(line.slice(6));
            } catch {
              continue;
            }

            switch (event.type) {
              case 'user_message':
                realUserMsg = event.message as Message;
                break;
              case 'pending_messages':
                realPendingMsgs = event.messages as Message[];
                break;
              case 'reaction':
                aiReaction = { messageId: event.messageId as string, reaction: event.reaction as string };
                break;
              case 'search':
                // 'searching' | 'reading' while gathering web results, 'empty' when
                // the search came back with nothing.
                setSearchState(event.state === 'reading' ? 'reading' : event.state === 'searching' ? 'searching' : 'idle');
                break;
              case 'sources': {
                sources = event.sources as WebSource[];
                setSearchState('idle');
                useChatStore.getState().patchMessage(assistantTempId, { sources });
                break;
              }
              case 'delta': {
                if (!receivedFirstDelta) {
                  receivedFirstDelta = true;
                  setSearchState('idle');
                  playReceive();
                }
                accumulated += event.content as string;
                useChatStore.getState().updateMessageContent(assistantTempId, accumulated);
                break;
              }
              case 'done': {
                const store = useChatStore.getState();
                const persisted = event.message as (Message & { tokens?: number }) | undefined;
                if (persisted?.tokens) addSessionTokens(persisted.tokens);
                const realAssistant = persisted
                  ? [{ ...persisted, sources: persisted.sources ?? sources, streaming: false }]
                  : [];
                const appended = [
                  ...(realUserMsg ? [realUserMsg] : []),
                  ...realPendingMsgs,
                  ...realAssistant,
                ];
                const appendedIds = new Set(appended.map((m) => m.id));
                const filtered = store.messages.filter(
                  (m) => !tempIds.includes(m.id) && !m.pending && !appendedIds.has(m.id)
                );
                let final: Message[] = [...filtered, ...appended];
                if (aiReaction) {
                  const r = aiReaction;
                  final = final.map((m) => (m.id === r.messageId ? { ...m, reaction: r.reaction } : m));
                }
                store.setMessages(final);

                // Only the first exchange names the conversation.
                if (titleSeed) {
                  updateConversation(convId, {
                    title: titleSeed.slice(0, 60) + (titleSeed.length > 60 ? '…' : ''),
                    updatedAt: new Date().toISOString(),
                    preview: accumulated.replace(/\s+/g, ' ').trim().slice(0, 120),
                  });
                } else {
                  updateConversation(convId, {
                    updatedAt: new Date().toISOString(),
                    preview: accumulated.replace(/\s+/g, ' ').trim().slice(0, 120),
                  });
                }
                break;
              }
              case 'error':
                throw new Error((event.error as string) || 'Stream error');
            }
          }
        }
      } catch {
        if (!aborted) {
          const store = useChatStore.getState();
          store.patchMessage(assistantTempId, { streaming: false });
          const hasContent = store.messages.find((m) => m.id === assistantTempId)?.content;
          if (!hasContent) {
            store.updateMessageContent(assistantTempId, '⚠️ Something went wrong. Please try again.');
          }
          toast.error('Max could not respond. Please try again.');
        }
      } finally {
        // Ensure the placeholder is no longer marked as streaming.
        useChatStore.getState().patchMessage(assistantTempId, { streaming: false });
        abortRef.current = null;
        setSearchState('idle');
        setStreaming(false);
      }
    },
    [accessToken, setStreaming, updateConversation, setSearchState, addSessionTokens]
  );

  // ── Send a new message ────────────────────────────────────────────
  const sendMessage = useCallback(
    async (content: string, options: SendOptions = {}) => {
      if (!content.trim()) return;

      let convId = activeConversationId;
      let isNew = false;
      if (!convId) {
        const { data } = await api.post('/chat/conversations', { model: selectedModel });
        addConversation(data);
        setActiveConversation(data.id);
        // Claim the (still empty) message list for the new conversation before
        // navigating, so the chat page knows it must not re-load it from the API
        // and wipe the optimistic + streaming messages we are about to add.
        setMessages([], data.id);
        convId = data.id;
        isNew = true;
        navigate(`/chat/${data.id}`, { replace: true });
      }

      const store = useChatStore.getState();
      const isFirst = isNew || store.messages.filter((m) => m.role === 'user').length === 0;
      const queueSnapshot = [...store.pendingQueue];
      clearPendingQueue();

      playSend();

      const now = Date.now();
      const tempUserId = `temp-user-${now}`;
      const tempAssistantId = `temp-assistant-${now}`;

      addMessage({
        id: tempUserId,
        role: 'user',
        content,
        createdAt: new Date().toISOString(),
        replyToId: options.replyToId ?? null,
      });
      addMessage({
        id: tempAssistantId,
        role: 'assistant',
        content: '',
        streaming: true,
        createdAt: new Date().toISOString(),
      });

      await runStream({
        url: `/api/chat/conversations/${convId}/messages`,
        method: 'POST',
        body: {
          content,
          model: selectedModel,
          webSearch: useChatStore.getState().webSearch,
          ...(options.replyToId ? { replyToId: options.replyToId } : {}),
          ...(queueSnapshot.length > 0 ? { pendingMessages: queueSnapshot } : {}),
        },
        convId: convId!,
        tempIds: [tempUserId, tempAssistantId],
        assistantTempId: tempAssistantId,
        titleSeed: isFirst ? content : null,
      });
    },
    [activeConversationId, selectedModel, navigate, addConversation, setActiveConversation, setMessages, addMessage, clearPendingQueue, runStream]
  );

  // ── Regenerate the last assistant reply ────────────────────────────
  const regenerate = useCallback(async () => {
    const store = useChatStore.getState();
    const convId = store.activeConversationId;
    if (!convId || store.isStreaming) return;

    // Drop trailing assistant messages locally, then add a fresh placeholder.
    const msgs = [...store.messages];
    let i = msgs.length - 1;
    while (i >= 0 && msgs[i].role !== 'user') i--;
    if (i < 0) return;
    const kept = msgs.slice(0, i + 1);

    const tempAssistantId = `temp-assistant-${Date.now()}`;
    store.setMessages([
      ...kept,
      { id: tempAssistantId, role: 'assistant', content: '', streaming: true, createdAt: new Date().toISOString() },
    ]);

    await runStream({
      url: `/api/chat/conversations/${convId}/regenerate`,
      method: 'POST',
      body: { model: selectedModel, webSearch: store.webSearch },
      convId,
      tempIds: [tempAssistantId],
      assistantTempId: tempAssistantId,
    });
  }, [selectedModel, runStream]);

  // ── Edit a user message and re-stream from that point ──────────────
  const editMessage = useCallback(
    async (messageId: string, content: string) => {
      const store = useChatStore.getState();
      const convId = store.activeConversationId;
      if (!convId || store.isStreaming || !content.trim()) return;

      const idx = store.messages.findIndex((m) => m.id === messageId);
      if (idx === -1) return;

      const kept = store.messages.slice(0, idx);
      const editedMsg: Message = { ...store.messages[idx], content, edited: true };
      const tempAssistantId = `temp-assistant-${Date.now()}`;
      store.setMessages([
        ...kept,
        editedMsg,
        { id: tempAssistantId, role: 'assistant', content: '', streaming: true, createdAt: new Date().toISOString() },
      ]);

      playSend();

      await runStream({
        url: `/api/chat/conversations/${convId}/messages/${messageId}`,
        method: 'PUT',
        body: { content, model: selectedModel, webSearch: store.webSearch },
        convId,
        tempIds: [tempAssistantId],
        assistantTempId: tempAssistantId,
      });
    },
    [selectedModel, runStream]
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.();
    setStreaming(false);
    const store = useChatStore.getState();
    store.messages
      .filter((m) => m.streaming)
      .forEach((m) => store.patchMessage(m.id, { streaming: false }));
  }, [setStreaming]);

  return { sendMessage, regenerate, editMessage, stopStreaming };
}
