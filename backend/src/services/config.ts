// Runtime configuration for the AI provider, resolved from (in order of
// priority):
//   1. Database settings (editable by the admin at runtime)
//   2. Environment variables (set at install time)
//   3. Built-in defaults
//
// maxAI talks to any endpoint that implements the standard Chat Completions
// API (the same protocol served by many hosted and self-hosted model
// gateways). A provider is therefore just a base URL, an API key and, per
// model tier, the model name to request.
//
// Secret values (API keys) are stored encrypted in the database. A tiny cache
// avoids hitting the DB on every streamed request; it is invalidated whenever
// the admin saves new settings and additionally expires after a few seconds.

import { prisma } from '../lib/prisma';
import { encryptSecret, decryptSecret, maskSecret } from '../lib/crypto';

export type ResolvedModelId = 'lite' | 'pro' | 'beast';
export const RESOLVED_MODELS: ResolvedModelId[] = ['lite', 'pro', 'beast'];

// A sensible default base URL. Any Chat-Completions-compatible endpoint works;
// this one lets an operator get started by providing only an API key.
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODELS: Record<ResolvedModelId, string> = {
  lite: 'gpt-4o-mini',
  pro: 'gpt-4o',
  beast: 'gpt-4o',
};

export interface ResolvedProviderModel {
  baseURL: string;
  apiKey: string;
  model: string;
}

export interface ResolvedProvider {
  models: Record<ResolvedModelId, ResolvedProviderModel>;
}

// ── Setting keys ─────────────────────────────────────────────────
const K_GLOBAL_BASE_URL = 'provider.global.baseURL';
const K_GLOBAL_APIKEY = 'provider.global.apiKey';
const modelKey = (m: ResolvedModelId, field: 'baseURL' | 'apiKey' | 'model') => `provider.${m}.${field}`;
const SECRET_KEYS = new Set([K_GLOBAL_APIKEY, ...RESOLVED_MODELS.map((m) => modelKey(m, 'apiKey'))]);

// ── DB access ────────────────────────────────────────────────────
async function readSettings(): Promise<Map<string, string>> {
  const rows = (await prisma.setting.findMany()) as Array<{ key: string; value: string; encrypted: boolean }>;
  const map = new Map<string, string>();
  for (const row of rows) {
    try {
      map.set(row.key, row.encrypted ? decryptSecret(row.value) : row.value);
    } catch {
      // A value we can't decrypt (e.g. key changed) is treated as unset.
    }
  }
  return map;
}

async function writeSetting(key: string, value: string | null): Promise<void> {
  if (value === null || value === '') {
    await prisma.setting.deleteMany({ where: { key } });
    return;
  }
  const encrypted = SECRET_KEYS.has(key);
  const stored = encrypted ? encryptSecret(value) : value;
  await prisma.setting.upsert({
    where: { key },
    update: { value: stored, encrypted },
    create: { key, value: stored, encrypted },
  });
}

// ── Resolution ───────────────────────────────────────────────────
function resolve(db: Map<string, string>): ResolvedProvider {
  const envBaseUrlGlobal = process.env.AI_BASE_URL || '';
  const envKeyGlobal = process.env.AI_API_KEY || '';

  const models = {} as Record<ResolvedModelId, ResolvedProviderModel>;
  for (const m of RESOLVED_MODELS) {
    const envBaseUrl = process.env[`AI_BASE_URL_${m.toUpperCase()}`] || '';
    const envKey = process.env[`AI_API_KEY_${m.toUpperCase()}`] || '';
    const envModel = process.env[`AI_MODEL_${m.toUpperCase()}`] || '';

    models[m] = {
      baseURL:
        db.get(modelKey(m, 'baseURL')) ||
        db.get(K_GLOBAL_BASE_URL) ||
        envBaseUrl ||
        envBaseUrlGlobal ||
        DEFAULT_BASE_URL,
      apiKey:
        db.get(modelKey(m, 'apiKey')) || db.get(K_GLOBAL_APIKEY) || envKey || envKeyGlobal || '',
      model: db.get(modelKey(m, 'model')) || envModel || DEFAULT_MODELS[m],
    };
  }
  return { models };
}

// ── Cache ────────────────────────────────────────────────────────
let cache: { value: ResolvedProvider; at: number } | null = null;
const TTL_MS = 5000;

export function invalidateProviderCache(): void {
  cache = null;
}

export async function getResolvedProvider(): Promise<ResolvedProvider> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = resolve(await readSettings());
  cache = { value, at: Date.now() };
  return value;
}

// ── Admin view / update ──────────────────────────────────────────
export interface AdminModelView {
  baseURL: string;
  model: string;
  apiKeySet: boolean;
  apiKeyHint: string;
  configured: boolean; // has both base URL + apiKey
}

export interface AdminProviderView {
  models: Record<ResolvedModelId, AdminModelView>;
}

export async function getAdminProviderView(): Promise<AdminProviderView> {
  const resolved = await getResolvedProvider();
  const models = {} as Record<ResolvedModelId, AdminModelView>;
  for (const m of RESOLVED_MODELS) {
    const mc = resolved.models[m];
    models[m] = {
      baseURL: mc.baseURL,
      model: mc.model,
      apiKeySet: mc.apiKey.length > 0,
      apiKeyHint: mc.apiKey ? maskSecret(mc.apiKey) : '',
      configured: mc.baseURL.length > 0 && mc.apiKey.length > 0,
    };
  }
  return { models };
}

export interface ProviderUpdate {
  models?: Partial<
    Record<ResolvedModelId, { baseURL?: string; model?: string; apiKey?: string | null }>
  >;
}

// Apply an admin update. `undefined` fields are left unchanged; an empty string
// clears baseURL/model (falling back to env/defaults); apiKey is only changed
// when a non-empty value is provided, or cleared when explicitly `null`.
export async function updateProviderConfig(update: ProviderUpdate): Promise<void> {
  for (const m of RESOLVED_MODELS) {
    const patch = update.models?.[m];
    if (!patch) continue;
    if (patch.baseURL !== undefined) await writeSetting(modelKey(m, 'baseURL'), patch.baseURL.trim());
    if (patch.model !== undefined) await writeSetting(modelKey(m, 'model'), patch.model.trim());
    if (patch.apiKey === null) {
      await writeSetting(modelKey(m, 'apiKey'), null);
    } else if (typeof patch.apiKey === 'string' && patch.apiKey.trim().length > 0) {
      await writeSetting(modelKey(m, 'apiKey'), patch.apiKey.trim());
    }
  }
  invalidateProviderCache();
}
