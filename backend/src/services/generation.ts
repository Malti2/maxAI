// Per-user generation settings.
//
// The model tiers ship with sensible defaults; these settings let a user nudge
// them without touching the server. Anything unset falls back to the tier
// default, and every value is clamped here so a bad value can never reach the
// provider (which would fail the whole turn with an opaque 400).

export const REASONING_EFFORTS = ['low', 'medium', 'high'] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export const DEFAULT_MAX_TOKENS = 4096;
export const DEFAULT_HISTORY_LIMIT = 50;

export const LIMITS = {
  temperature: { min: 0, max: 2 },
  maxTokens: { min: 256, max: 32_000 },
  historyLimit: { min: 2, max: 200 },
} as const;

export interface GenerationSettings {
  /** Undefined = use the tier's default temperature. */
  temperature?: number;
  maxTokens: number;
  /** How many stored messages are sent as context. */
  historyLimit: number;
  reasoningEffort?: ReasoningEffort;
}

export interface GenerationSettingsInput {
  temperature?: number | null;
  maxTokens?: number | null;
  historyLimit?: number | null;
  reasoningEffort?: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return typeof value === 'string' && (REASONING_EFFORTS as readonly string[]).includes(value);
}

export function resolveGenerationSettings(input?: GenerationSettingsInput | null): GenerationSettings {
  const temperature =
    typeof input?.temperature === 'number' && Number.isFinite(input.temperature)
      ? clamp(input.temperature, LIMITS.temperature.min, LIMITS.temperature.max)
      : undefined;

  const maxTokens =
    typeof input?.maxTokens === 'number' && Number.isFinite(input.maxTokens) && input.maxTokens > 0
      ? Math.round(clamp(input.maxTokens, LIMITS.maxTokens.min, LIMITS.maxTokens.max))
      : DEFAULT_MAX_TOKENS;

  const historyLimit =
    typeof input?.historyLimit === 'number' && Number.isFinite(input.historyLimit) && input.historyLimit > 0
      ? Math.round(clamp(input.historyLimit, LIMITS.historyLimit.min, LIMITS.historyLimit.max))
      : DEFAULT_HISTORY_LIMIT;

  const settings: GenerationSettings = { maxTokens, historyLimit };
  if (temperature !== undefined) settings.temperature = temperature;
  if (isReasoningEffort(input?.reasoningEffort)) settings.reasoningEffort = input.reasoningEffort;
  return settings;
}
