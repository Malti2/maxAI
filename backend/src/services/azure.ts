import OpenAI from 'openai';

export type ModelId = 'lite' | 'pro' | 'beast' | 'auto';

interface ModelConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
  displayName: string;
  description: string;
}

function getModelConfigs(): Record<string, ModelConfig> {
  return {
    lite: {
      endpoint: process.env.AZURE_ENDPOINT_LITE || process.env.AZURE_ENDPOINT || '',
      apiKey: process.env.AZURE_API_KEY_LITE || process.env.AZURE_API_KEY || '',
      deployment: process.env.AZURE_DEPLOYMENT_LITE || 'gpt-4o-mini',
      apiVersion: process.env.AZURE_API_VERSION || '2024-08-01-preview',
      displayName: 'Max Lite',
      description: 'Fast & efficient for everyday tasks',
    },
    pro: {
      endpoint: process.env.AZURE_ENDPOINT_PRO || process.env.AZURE_ENDPOINT || '',
      apiKey: process.env.AZURE_API_KEY_PRO || process.env.AZURE_API_KEY || '',
      deployment: process.env.AZURE_DEPLOYMENT_PRO || 'gpt-4o',
      apiVersion: process.env.AZURE_API_VERSION || '2024-08-01-preview',
      displayName: 'Max Pro',
      description: 'Powerful for complex tasks',
    },
    beast: {
      endpoint: process.env.AZURE_ENDPOINT_BEAST || process.env.AZURE_ENDPOINT || '',
      apiKey: process.env.AZURE_API_KEY_BEAST || process.env.AZURE_API_KEY || '',
      deployment: process.env.AZURE_DEPLOYMENT_BEAST || 'gpt-4o',
      apiVersion: process.env.AZURE_API_VERSION || '2024-08-01-preview',
      displayName: 'Max Beast',
      description: 'Maximum performance for the most demanding tasks',
    },
  };
}

// Auto model selection based on message complexity
export function selectAutoModel(messages: Array<{ role: string; content: string }>): ModelId {
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
  if (!lastUserMessage) return 'pro';

  const content = lastUserMessage.content;
  const wordCount = content.split(/\s+/).length;
  const hasCode = /```|function|class|import|export|const |let |var /.test(content);
  // Detect complexity cues in both English and German so Auto works
  // regardless of the language the user writes in.
  const hasComplexTerms =
    /analy[sz]|explain|compare|create|write|calculate|optimi[sz]e|debug|refactor|design|erkläre|vergleich|erstelle|schreib|berechne|optimier/i.test(content);

  if (wordCount > 150 || hasCode || hasComplexTerms) {
    return 'beast';
  } else if (wordCount > 40 || hasComplexTerms) {
    return 'pro';
  }
  return 'lite';
}

export async function createAzureClient(modelId: ModelId): Promise<{ client: OpenAI; deployment: string; resolvedModel: ModelId }> {
  const configs = getModelConfigs();
  let resolvedModel = modelId;

  if (modelId === 'auto') {
    resolvedModel = 'pro'; // default, will be overridden by caller if needed
  }

  const config = configs[resolvedModel as string];
  if (!config) throw new Error(`Unknown model: ${resolvedModel}`);

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: `${config.endpoint}/openai/deployments/${config.deployment}`,
    defaultQuery: { 'api-version': config.apiVersion },
    defaultHeaders: { 'api-key': config.apiKey },
  });

  return { client, deployment: config.deployment, resolvedModel };
}

export async function streamChat(
  modelId: ModelId,
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
  systemPrompt?: string,
  onChunk?: (chunk: string) => void
): Promise<{ content: string; model: ModelId; tokens?: number }> {
  let resolvedModel = modelId;

  if (modelId === 'auto') {
    resolvedModel = selectAutoModel(messages);
  }

  const configs = getModelConfigs();
  const config = configs[resolvedModel];

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: `${config.endpoint}/openai/deployments/${config.deployment}`,
    defaultQuery: { 'api-version': config.apiVersion },
    defaultHeaders: { 'api-key': config.apiKey },
  });

  const messageList = [];
  if (systemPrompt) {
    messageList.push({ role: 'system' as const, content: systemPrompt });
  }
  messageList.push(...messages);

  let fullContent = '';
  let totalTokens: number | undefined;

  const stream = await client.chat.completions.create({
    model: config.deployment,
    messages: messageList,
    stream: true,
    max_tokens: 4096,
  });

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
