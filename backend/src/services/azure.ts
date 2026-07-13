import OpenAI from 'openai';

export type ModelId = 'lite' | 'pro' | 'beast' | 'auto';
export type ResolvedModelId = Exclude<ModelId, 'auto'>;

interface ModelConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
  displayName: string;
  description: string;
  temperature: number;
}

const DEFAULT_API_VERSION = '2024-08-01-preview';

function getModelConfigs(): Record<ResolvedModelId, ModelConfig> {
  return {
    lite: {
      endpoint: process.env.AZURE_ENDPOINT_LITE || process.env.AZURE_ENDPOINT || '',
      apiKey: process.env.AZURE_API_KEY_LITE || process.env.AZURE_API_KEY || '',
      deployment: process.env.AZURE_DEPLOYMENT_LITE || 'gpt-4o-mini',
      apiVersion: process.env.AZURE_API_VERSION || DEFAULT_API_VERSION,
      displayName: 'Max Lite',
      description: 'Fast & efficient for everyday tasks',
      temperature: 0.7,
    },
    pro: {
      endpoint: process.env.AZURE_ENDPOINT_PRO || process.env.AZURE_ENDPOINT || '',
      apiKey: process.env.AZURE_API_KEY_PRO || process.env.AZURE_API_KEY || '',
      deployment: process.env.AZURE_DEPLOYMENT_PRO || 'gpt-4o',
      apiVersion: process.env.AZURE_API_VERSION || DEFAULT_API_VERSION,
      displayName: 'Max Pro',
      description: 'Powerful for complex tasks',
      temperature: 0.7,
    },
    beast: {
      endpoint: process.env.AZURE_ENDPOINT_BEAST || process.env.AZURE_ENDPOINT || '',
      apiKey: process.env.AZURE_API_KEY_BEAST || process.env.AZURE_API_KEY || '',
      deployment: process.env.AZURE_DEPLOYMENT_BEAST || 'gpt-4o',
      apiVersion: process.env.AZURE_API_VERSION || DEFAULT_API_VERSION,
      displayName: 'Max Beast',
      description: 'Maximum performance for the most demanding tasks',
      temperature: 0.8,
    },
  };
}

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

  if (wordCount > 150 || hasCode || hasComplexTerms) {
    return 'beast';
  } else if (wordCount > 40) {
    return 'pro';
  }
  return 'lite';
}

// Resolve 'auto' to a concrete model for a given history.
export function resolveModel(modelId: ModelId, messages: Array<{ role: string; content: string }>): ResolvedModelId {
  return modelId === 'auto' ? selectAutoModel(messages) : modelId;
}

function createClient(config: ModelConfig): OpenAI {
  if (!config.endpoint || !config.apiKey) {
    throw new Error(
      'Azure OpenAI is not configured. Set AZURE_ENDPOINT and AZURE_API_KEY (or the per-model overrides) in your environment.'
    );
  }
  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: `${config.endpoint}/openai/deployments/${config.deployment}`,
    defaultQuery: { 'api-version': config.apiVersion },
    defaultHeaders: { 'api-key': config.apiKey },
  });
}

export interface StreamResult {
  content: string;
  model: ResolvedModelId;
  tokens?: number;
}

export async function streamChat(
  modelId: ModelId,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemPrompt?: string,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<StreamResult> {
  const resolvedModel = resolveModel(modelId, messages);
  const config = getModelConfigs()[resolvedModel];
  const client = createClient(config);

  const messageList: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  if (systemPrompt) {
    messageList.push({ role: 'system', content: systemPrompt });
  }
  messageList.push(...messages);

  let fullContent = '';
  let totalTokens: number | undefined;

  const stream = await client.chat.completions.create(
    {
      model: config.deployment,
      messages: messageList,
      stream: true,
      temperature: config.temperature,
      max_tokens: 4096,
      // Ask Azure to include a final usage chunk so we can record token counts.
      stream_options: { include_usage: true },
    },
    { signal }
  );

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      fullContent += delta;
      onChunk?.(delta);
    }
    if (chunk.usage) {
      totalTokens = chunk.usage.total_tokens;
    }
  }

  return { content: fullContent, model: resolvedModel, tokens: totalTokens };
}
