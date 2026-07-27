// Shared "assistant turn" streaming pipeline.
//
// Both sending a message and regenerating a response need the exact same
// machinery: resolve the model, stream tokens over SSE, strip the Chat Mode
// control block, apply an AI tapback/reply, and persist the assistant message.
// Keeping it in one place means the two endpoints can never drift apart.

import type { Response } from 'express';
import { prisma } from '../lib/prisma';
import { streamChat, resolveModel, type ModelId } from './ai';
import { AssistantStreamFilter, type ApiMessage } from './chatMode';
import type { GenerationSettings } from './generation';
import type { WebSource } from './websearch';

export interface AssistantTurnParams {
  res: Response;
  conversationId: string;
  history: ApiMessage[];
  systemPrompt: string;
  requestedModel: ModelId;
  chatMode: boolean;
  // The message an AI-authored tapback / reply attaches to (the user's most
  // recent message). Null when reactions/replies don't apply.
  reactionTargetId: string | null;
  settings?: GenerationSettings;
  // Web-search sources backing this answer; stored with the message so the
  // citations survive a reload.
  sources?: WebSource[];
  signal?: AbortSignal;
}

export interface AssistantTurnResult {
  assistantMessage: Awaited<ReturnType<typeof prisma.message.create>> | null;
  reaction: { messageId: string; reaction: string } | null;
  aborted: boolean;
}

function sse(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function streamAssistantTurn(params: AssistantTurnParams): Promise<AssistantTurnResult> {
  const {
    res, conversationId, history, systemPrompt, requestedModel, chatMode, reactionTargetId,
    settings, sources, signal,
  } = params;

  const resolvedModel = resolveModel(requestedModel, history);
  sse(res, { type: 'model', model: resolvedModel });

  const filter = new AssistantStreamFilter();
  let visibleContent = '';
  let tokens: number | undefined;
  let aborted = false;

  try {
    const result = await streamChat({
      modelId: resolvedModel,
      messages: history,
      systemPrompt,
      settings,
      signal,
      onChunk: (chunk) => {
        const visible = chatMode ? filter.push(chunk) : chunk;
        if (visible) {
          visibleContent += visible;
          sse(res, { type: 'delta', content: visible });
        }
      },
    });
    tokens = result.tokens;
  } catch (err) {
    // A client disconnect (Stop) aborts the upstream stream. That's expected —
    // keep whatever was generated so far and persist it instead of discarding.
    if (signal?.aborted || (err as Error)?.name === 'AbortError' || (err as Error)?.name === 'APIUserAbortError') {
      aborted = true;
    } else {
      throw err;
    }
  }

  if (chatMode) {
    const tail = filter.end();
    if (tail) {
      visibleContent += tail;
      sse(res, { type: 'delta', content: tail });
    }
  }

  const control = filter.getControl();

  // Apply an AI-authored tapback to the target message.
  let reaction: { messageId: string; reaction: string } | null = null;
  if (!aborted && chatMode && control.reaction && reactionTargetId) {
    await prisma.message.update({
      where: { id: reactionTargetId },
      data: { reaction: control.reaction },
    });
    reaction = { messageId: reactionTargetId, reaction: control.reaction };
    sse(res, { type: 'reaction', ...reaction });
  }

  // Persist the assistant message — unless it is a bare tapback (a reaction
  // with no text), in which case the reaction itself is the reply.
  let assistantMessage: AssistantTurnResult['assistantMessage'] = null;
  if (visibleContent.trim().length > 0) {
    assistantMessage = await prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: visibleContent,
        model: resolvedModel,
        tokens,
        replyToId: chatMode && control.isReply ? reactionTargetId : null,
        // Keep only what the UI needs for the citation chips — the page text
        // itself is context for one turn, not something worth storing.
        sources: sources?.length
          ? sources.map((s) => ({ title: s.title, url: s.url, snippet: s.snippet }))
          : undefined,
      },
    });
  }

  return { assistantMessage, reaction, aborted };
}
