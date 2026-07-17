import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChatStore, type Message } from '../store/chatStore';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { playSend, playReceive } from '../lib/sounds';
import api, { refreshAccessToken } from '../lib/api';

// Fetch an SSE endpoint with the current access token, transparently refreshing
// it once on a 401. The streaming endpoints use raw `fetch` (EventSource can't
// send an Authorization header), so they can't rely on the axios interceptor —
// this mirrors that refresh-and-retry behaviour for the streaming path, so a
// message sent after the short-lived access token has expired still goes
// through instead of failing.
async function authedFetch(
  url: string,
  method: 'POST' | 'PUT',
  body: Record<string, unknown>
): Promise<Response> {
  const send = (token: string | null) =>
    fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  const token = useAuthStore.getState().accessToken;
  const response = await send(token);
  if (response.status !== 401) return response;

  const fresh = await refreshAccessToken();
  if (!fresh) return response;
  return send(fresh);
}

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
    updateConversation,
    clearPendingQueue,
  } = useChatStore();
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
        const response = await authedFetch(url, method, body);

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
              case 'delta': {
                if (!receivedFirstDelta) {
                  receivedFirstDelta = true;
                  playReceive();
                }
                accumulated += event.content as string;
                useChatStore.getState().updateMessageContent(assistantTempId, accumulated);
                break;
              }
              case 'done': {
                const store = useChatStore.getState();
                const realAssistant = event.message
                  ? [{ ...(event.message as Message), streaming: false }]
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
        setStreaming(false);
      }
    },
    [setStreaming, updateConversation]
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
          ...(options.replyToId ? { replyToId: options.replyToId } : {}),
          ...(queueSnapshot.length > 0 ? { pendingMessages: queueSnapshot } : {}),
        },
        convId: convId!,
        tempIds: [tempUserId, tempAssistantId],
        assistantTempId: tempAssistantId,
        titleSeed: isFirst ? content : null,
      });
    },
    [activeConversationId, selectedModel, navigate, addConversation, setActiveConversation, addMessage, clearPendingQueue, runStream]
  );

  // ── Deliver queued Chat Mode messages ──────────────────────────────
  // In Chat Mode the user can keep typing while Max is still answering; those
  // messages are shown immediately as "pending" and buffered in pendingQueue.
  // Once the current turn finishes, this delivers the whole buffer as a single
  // follow-up turn — the first queued message is the primary content and the
  // rest ride along as pendingMessages — so Max answers all of them together
  // and in order (see ChatPage, which calls this when streaming ends).
  const flushQueue = useCallback(async () => {
    const store = useChatStore.getState();
    const convId = store.activeConversationId;
    if (!convId || store.isStreaming) return;

    const queue = [...store.pendingQueue];
    if (queue.length === 0) return;
    clearPendingQueue();

    const [primary, ...rest] = queue;
    const tempAssistantId = `temp-assistant-${Date.now()}`;
    // The queued messages are already on screen as pending bubbles; runStream's
    // "done" handler reconciles them with their persisted counterparts. We only
    // need to add the assistant placeholder here.
    store.addMessage({
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
        content: primary,
        model: store.selectedModel,
        ...(rest.length > 0 ? { pendingMessages: rest } : {}),
      },
      convId,
      tempIds: [tempAssistantId],
      assistantTempId: tempAssistantId,
    });
  }, [clearPendingQueue, runStream]);

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
      body: { model: selectedModel },
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
        body: { content, model: selectedModel },
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

  return { sendMessage, regenerate, editMessage, stopStreaming, flushQueue };
}
