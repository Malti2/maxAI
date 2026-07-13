// Runtime configuration for Azure OpenAI, resolved from (in order of priority):
//   1. Database settings (editable by the admin at runtime)
//   2. Environment variables (set at install time)
//   3. Built-in defaults
//
// Secret values (API keys) are stored encrypted in the database. A tiny cache
// avoids hitting the DB on every streamed request; it is invalidated whenever
// the admin saves new settings and additionally expires after a few seconds.

import { prisma } from '../lib/prisma';
import { encryptSecret, decryptSecret, maskSecret } from '../lib/crypto';

export type ResolvedModelId = 'lite' | 'pro' | 'beast';
export const RESOLVED_MODELS: ResolvedModelId[] = ['lite', 'pro', 'beast'];

const DEFAULT_API_VERSION = '2024-08-01-preview';
const DEFAULT_DEPLOYMENTS: Record<ResolvedModelId, string> = {
  lite: 'gpt-4o-mini',
  pro: 'gpt-4o',
  beast: 'gpt-4o',
};

export interface ResolvedAzureModel {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

export interface ResolvedAzure {
  apiVersion: string;
  models: Record<ResolvedModelId, ResolvedAzureModel>;
}

// ── Setting keys ─────────────────────────────────────────────────
const K_API_VERSION = 'azure.apiVersion';
const K_GLOBAL_ENDPOINT = 'azure.global.endpoint';
const K_GLOBAL_APIKEY = 'azure.global.apiKey';
const modelKey = (m: ResolvedModelId, field: 'endpoint' | 'apiKey' | 'deployment') => `azure.${m}.${field}`;
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
function resolve(db: Map<string, string>): ResolvedAzure {
  const envEndpointGlobal = process.env.AZURE_ENDPOINT || '';
  const envKeyGlobal = process.env.AZURE_API_KEY || '';
  const apiVersion = db.get(K_API_VERSION) || process.env.AZURE_API_VERSION || DEFAULT_API_VERSION;

  const models = {} as Record<ResolvedModelId, ResolvedAzureModel>;
  for (const m of RESOLVED_MODELS) {
    const envEndpoint = process.env[`AZURE_ENDPOINT_${m.toUpperCase()}`] || '';
    const envKey = process.env[`AZURE_API_KEY_${m.toUpperCase()}`] || '';
    const envDeployment = process.env[`AZURE_DEPLOYMENT_${m.toUpperCase()}`] || '';

    models[m] = {
      endpoint: db.get(modelKey(m, 'endpoint')) || db.get(K_GLOBAL_ENDPOINT) || envEndpoint || envEndpointGlobal || '',
      apiKey: db.get(modelKey(m, 'apiKey')) || db.get(K_GLOBAL_APIKEY) || envKey || envKeyGlobal || '',
      deployment: db.get(modelKey(m, 'deployment')) || envDeployment || DEFAULT_DEPLOYMENTS[m],
      apiVersion,
    };
  }
  return { apiVersion, models };
}

// ── Cache ────────────────────────────────────────────────────────
let cache: { value: ResolvedAzure; at: number } | null = null;
const TTL_MS = 5000;

export function invalidateAzureCache(): void {
  cache = null;
}

export async function getResolvedAzure(): Promise<ResolvedAzure> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = resolve(await readSettings());
  cache = { value, at: Date.now() };
  return value;
}

// ── Admin view / update ──────────────────────────────────────────
export interface AdminModelView {
  endpoint: string;
  deployment: string;
  apiKeySet: boolean;
  apiKeyHint: string;
  configured: boolean; // has both endpoint + apiKey
}

export interface AdminAzureView {
  apiVersion: string;
  models: Record<ResolvedModelId, AdminModelView>;
}

export async function getAdminAzureView(): Promise<AdminAzureView> {
  const resolved = await getResolvedAzure();
  const models = {} as Record<ResolvedModelId, AdminModelView>;
  for (const m of RESOLVED_MODELS) {
    const mc = resolved.models[m];
    models[m] = {
      endpoint: mc.endpoint,
      deployment: mc.deployment,
      apiKeySet: mc.apiKey.length > 0,
      apiKeyHint: mc.apiKey ? maskSecret(mc.apiKey) : '',
      configured: mc.endpoint.length > 0 && mc.apiKey.length > 0,
    };
  }
  return { apiVersion: resolved.apiVersion, models };
}

export interface AzureUpdate {
  apiVersion?: string;
  models?: Partial<
    Record<ResolvedModelId, { endpoint?: string; deployment?: string; apiKey?: string | null }>
  >;
}

// Apply an admin update. `undefined` fields are left unchanged; an empty string
// clears endpoint/deployment (falling back to env); apiKey is only changed when
// a non-empty value is provided, or cleared when explicitly `null`.
export async function updateAzureConfig(update: AzureUpdate): Promise<void> {
  if (update.apiVersion !== undefined) {
    await writeSetting(K_API_VERSION, update.apiVersion.trim());
  }
  for (const m of RESOLVED_MODELS) {
    const patch = update.models?.[m];
    if (!patch) continue;
    if (patch.endpoint !== undefined) await writeSetting(modelKey(m, 'endpoint'), patch.endpoint.trim());
    if (patch.deployment !== undefined) await writeSetting(modelKey(m, 'deployment'), patch.deployment.trim());
    if (patch.apiKey === null) {
      await writeSetting(modelKey(m, 'apiKey'), null);
    } else if (typeof patch.apiKey === 'string' && patch.apiKey.trim().length > 0) {
      await writeSetting(modelKey(m, 'apiKey'), patch.apiKey.trim());
    }
  }
  invalidateAzureCache();
}
