import { selectAutoModel, resolveModel } from '../src/services/azure';
import { toPublicUser } from '../src/lib/serialize';

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
    // fields that must NOT leak:
    password: 'hash', createdAt: new Date(), updatedAt: new Date(),
  } as never;
  const pub = toPublicUser(row) as Record<string, unknown>;
  eq('password' in pub, false, 'password is never exposed');
  eq(pub.soundEnabled, true, 'soundEnabled included');
  eq(pub.systemPrompt, null, 'systemPrompt included (even when null)');
  eq(Object.keys(pub).sort(), [
    'avatarColor', 'chatMode', 'defaultModel', 'email', 'id', 'name',
    'onboardingDone', 'personality', 'soundEnabled', 'systemPrompt',
  ], 'exact public key set');
}

console.log(`\nunits: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
