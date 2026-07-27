// Ensure env is valid before importing modules that read it lazily.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'x'.repeat(40);

import { selectAutoModel, resolveModel } from '../src/services/ai';
import { toPublicUser } from '../src/lib/serialize';
import { encryptSecret, decryptSecret, maskSecret } from '../src/lib/crypto';

let passed = 0;
let failed = 0;

function eq(actual: unknown, expected: unknown, msg: string) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) passed++;
  else { failed++; console.error(`  ✗ ${msg} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`); }
}

// ── selectAutoModel ──────────────────────────────────────────────
{
  eq(selectAutoModel([{ role: 'user', content: 'hi' }]), 'lite', 'short → lite');
  eq(
    selectAutoModel([{ role: 'user', content: 'Please explain how OAuth works' }]),
    'beast',
    'complex term (explain) → beast'
  );
  eq(
    selectAutoModel([{ role: 'user', content: '```js\nconst x = 1\n```' }]),
    'beast',
    'code fence → beast'
  );
  const medium = Array(60).fill('word').join(' ');
  eq(selectAutoModel([{ role: 'user', content: medium }]), 'pro', '~60 words, no cues → pro');
  eq(selectAutoModel([]), 'pro', 'empty history → pro default');
  eq(
    selectAutoModel([{ role: 'assistant', content: 'analyse everything' }, { role: 'user', content: 'ok' }]),
    'lite',
    'uses last USER message, not assistant'
  );
  eq(
    selectAutoModel([{ role: 'user', content: 'Bitte erkläre mir Rekursion' }]),
    'beast',
    'German complexity cue (erkläre) → beast'
  );
}

// ── resolveModel ─────────────────────────────────────────────────
{
  eq(resolveModel('lite', []), 'lite', 'explicit lite stays lite');
  eq(resolveModel('beast', []), 'beast', 'explicit beast stays beast');
  eq(resolveModel('auto', [{ role: 'user', content: 'hi' }]), 'lite', 'auto resolves via selectAutoModel');
}

// ── toPublicUser ─────────────────────────────────────────────────
{
  const row = {
    id: 'u1', email: 'a@b.co', name: 'A', onboardingDone: true, defaultModel: 'auto',
    personality: 'assistant', chatMode: false, soundEnabled: true, avatarColor: '#0a84ff',
    systemPrompt: null,
    webSearch: true, webSearchSources: 4, webSearchReadPages: true,
    temperature: null, maxTokens: null, historyLimit: 50, reasoningEffort: null,
    // fields that must NOT leak:
    password: 'hash', createdAt: new Date(), updatedAt: new Date(),
  } as never;
  const pub = toPublicUser(row) as Record<string, unknown>;
  eq('password' in pub, false, 'password is never exposed');
  eq(pub.soundEnabled, true, 'soundEnabled included');
  eq(pub.systemPrompt, null, 'systemPrompt included (even when null)');
  eq(pub.webSearch, true, 'webSearch included');
  eq(pub.historyLimit, 50, 'historyLimit included');
  eq(pub.isAdmin, false, 'isAdmin false when ADMIN_EMAIL unset');
  eq(Object.keys(pub).sort(), [
    'avatarColor', 'chatMode', 'defaultModel', 'email', 'historyLimit', 'id', 'isAdmin',
    'maxTokens', 'name', 'onboardingDone', 'personality', 'reasoningEffort', 'soundEnabled',
    'systemPrompt', 'temperature', 'webSearch', 'webSearchReadPages', 'webSearchSources',
  ], 'exact public key set');
}

// ── crypto (encrypt/decrypt/mask) ────────────────────────────────
{
  const secret = 'sk-abcdef123456';
  const enc = encryptSecret(secret);
  eq(enc.startsWith('v1:'), true, 'ciphertext is versioned');
  eq(enc.includes(secret), false, 'ciphertext does not contain the plaintext');
  eq(decryptSecret(enc), secret, 'decrypt round-trips');
  eq(encryptSecret(secret) !== encryptSecret(secret), true, 'random IV → different ciphertext each time');
  eq(maskSecret(secret), '••••3456', 'mask shows only the last 4 chars');
  let threw = false;
  try { decryptSecret('v1:00:00:00'); } catch { threw = true; }
  eq(threw, true, 'tampered ciphertext throws');
}

console.log(`\nunits: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
