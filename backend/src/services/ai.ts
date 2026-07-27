import OpenAI from 'openai';
import { getResolvedProvider, type ResolvedModelId, type ResolvedProviderModel } from './config';
import { DEFAULT_MAX_TOKENS, type GenerationSettings } from './generation';

export type ModelId = 'lite' | 'pro' | 'beast' | 'auto';
export type { ResolvedModelId } from './config';

const TEMPERATURE: Record<ResolvedModelId, number> = { lite: 0.7, pro: 0.7, beast: 0.8 };

// Auto model selection based on message complexity.
export function selectAutoModel(messages: Array<{ role: string; content: string }>): ResolvedModelId {
  const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMessage) return 'pro';

  const content = lastUserMessage.content;
  const wordCount = content.split(/\s+/).length;
  const hasCode = /```|function|class|import|export|const |let |var /.test(content);
  // Detect complexity cues in both English and German so Auto works
  // regardless of the language the user writes in.
  const hasComplexTerms =
    /analy[sz]|explain|compare|create|write|calculate|optimi[sz]e|debug|refactor|design|erkläre|vergleich|erstelle|schreib|berechne|optimier/i.test(
      content
    );

  if (wordCount > 150 || hasCode || hasComplexTerms) return 'beast';
  if (wordCount > 40) return 'pro';
  return 'lite';
}

export function resolveModel(modelId: ModelId, messages: Array<{ role: string; content: string }>): ResolvedModelId {
  return modelId === 'auto' ? selectAutoModel(messages) : modelId;
}

function createClient(mc: ResolvedProviderModel): OpenAI {
  if (!mc.baseURL || !mc.apiKey) {
    throw new Error(
      'The AI provider is not configured. Add your API base URL and key in the admin area (or the .env file).'
    );
  }
  return new OpenAI({
    apiKey: mc.apiKey,
    baseURL: mc.baseURL.replace(/\/+$/, ''),
  });
}

export interface StreamResult {
  content: string;
  model: ResolvedModelId;
  tokens?: number;
}

export interface StreamChatParams {
  modelId: ModelId;
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  systemPrompt?: string;
  /** Per-user generation settings; anything unset falls back to the tier default. */
  settings?: GenerationSettings;
  onChunk?: (chunk: string) => void;
  signal?: AbortSignal;
}

export async function streamChat(params: StreamChatParams): Promise<StreamResult> {
  const { modelId, messages, systemPrompt, settings, onChunk, signal } = params;
  const resolvedModel = resolveModel(modelId, messages);
  const provider = await getResolvedProvider();
  const mc = provider.models[resolvedModel];
  const client = createClient(mc);

  const messageList: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  if (systemPrompt) messageList.push({ role: 'system', content: systemPrompt });
  messageList.push(...messages);

  let fullContent = '';
  let totalTokens: number | undefined;

  const stream = await client.chat.completions.create(
    {
      model: mc.model,
      messages: messageList,
      stream: true,
      temperature: settings?.temperature ?? TEMPERATURE[resolvedModel],
      max_tokens: settings?.maxTokens ?? DEFAULT_MAX_TOKENS,
      stream_options: { include_usage: true },
      // Only sent when the user opted in — providers without reasoning support
      // reject unknown parameters.
      ...(settings?.reasoningEffort ? { reasoning_effort: settings.reasoningEffort } : {}),
    },
    { signal }
  );

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      fullContent += delta;
      onChunk?.(delta);
    }
    if (chunk.usage) totalTokens = chunk.usage.total_tokens;
  }

  return { content: fullContent, model: resolvedModel, tokens: totalTokens };
}

// Lightweight connectivity check used by the admin area. Sends a 1-token
// completion and reports success or a clean error message.
export async function testModel(modelId: ResolvedModelId): Promise<{ ok: boolean; error?: string }> {
  try {
    const provider = await getResolvedProvider();
    const mc = provider.models[modelId];
    const client = createClient(mc);
    await client.chat.completions.create({
      model: mc.model,
      messages: [{ role: 'user', content: 'ping' }],
      max_tokens: 1,
    });
    return { ok: true };
  } catch (err) {
    const message = (err as { message?: string })?.message || 'Connection failed';
    return { ok: false, error: message.slice(0, 200) };
  }
}
