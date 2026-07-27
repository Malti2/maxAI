// Generation settings: defaults, clamping and rejection of nonsense values.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(40);

import {
  resolveGenerationSettings,
  DEFAULT_MAX_TOKENS,
  DEFAULT_HISTORY_LIMIT,
  LIMITS,
} from '../src/services/generation';

let passed = 0;
let failed = 0;

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else { failed++; console.error(`  ✗ ${msg} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`); }
}

// ── Defaults ─────────────────────────────────────────────────────
{
  eq(
    resolveGenerationSettings(null),
    { maxTokens: DEFAULT_MAX_TOKENS, historyLimit: DEFAULT_HISTORY_LIMIT },
    'no user → defaults, no temperature override'
  );
  eq(
    resolveGenerationSettings({ temperature: null, maxTokens: null, historyLimit: null, reasoningEffort: null }),
    { maxTokens: DEFAULT_MAX_TOKENS, historyLimit: DEFAULT_HISTORY_LIMIT },
    'all null → defaults'
  );
  eq('temperature' in resolveGenerationSettings({}), false, 'temperature stays unset (tier default applies)');
}

// ── Clamping ─────────────────────────────────────────────────────
{
  eq(resolveGenerationSettings({ temperature: 0 }).temperature, 0, 'temperature 0 is kept');
  eq(resolveGenerationSettings({ temperature: 5 }).temperature, LIMITS.temperature.max, 'temperature clamped to max');
  eq(resolveGenerationSettings({ temperature: -3 }).temperature, LIMITS.temperature.min, 'temperature clamped to min');
  eq(resolveGenerationSettings({ maxTokens: 99 }).maxTokens, LIMITS.maxTokens.min, 'maxTokens clamped to min');
  eq(resolveGenerationSettings({ maxTokens: 999_999 }).maxTokens, LIMITS.maxTokens.max, 'maxTokens clamped to max');
  eq(resolveGenerationSettings({ maxTokens: 8192 }).maxTokens, 8192, 'valid maxTokens kept');
  eq(resolveGenerationSettings({ maxTokens: 0 }).maxTokens, DEFAULT_MAX_TOKENS, '0 means "provider default"');
  eq(resolveGenerationSettings({ historyLimit: 1 }).historyLimit, LIMITS.historyLimit.min, 'historyLimit clamped to min');
  eq(resolveGenerationSettings({ historyLimit: 5000 }).historyLimit, LIMITS.historyLimit.max, 'historyLimit clamped to max');
  eq(resolveGenerationSettings({ historyLimit: 12 }).historyLimit, 12, 'valid historyLimit kept');
  eq(resolveGenerationSettings({ maxTokens: 4096.6 }).maxTokens, 4097, 'fractional token counts are rounded');
}

// ── Garbage in ───────────────────────────────────────────────────
{
  eq('temperature' in resolveGenerationSettings({ temperature: NaN }), false, 'NaN temperature ignored');
  eq(resolveGenerationSettings({ maxTokens: Infinity }).maxTokens, DEFAULT_MAX_TOKENS, 'Infinity ignored');
  eq(
    resolveGenerationSettings({ maxTokens: '8000' as unknown as number }).maxTokens,
    DEFAULT_MAX_TOKENS,
    'string value ignored'
  );
}

// ── Reasoning effort ─────────────────────────────────────────────
{
  eq(resolveGenerationSettings({ reasoningEffort: 'high' }).reasoningEffort, 'high', 'valid effort kept');
  eq('reasoningEffort' in resolveGenerationSettings({ reasoningEffort: 'extreme' }), false, 'unknown effort dropped');
  eq('reasoningEffort' in resolveGenerationSettings({ reasoningEffort: '' }), false, 'empty effort dropped');
}

console.log(`\ngeneration: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
