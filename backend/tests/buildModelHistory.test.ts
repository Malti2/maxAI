import { buildModelHistory } from '../src/services/chatMode';

let passed = 0;
let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) passed++;
  else { failed++; console.error(`  ✗ ${msg}`); }
}

type M = { id: string; role: string; content: string; reaction: string | null; replyToId: string | null };
const mk = (id: string, role: string, content: string, reaction: string | null = null, replyToId: string | null = null): M =>
  ({ id, role, content, reaction, replyToId });

// 1. Plain history: user + assistant, no reactions/replies → 2 messages, no system notes.
{
  const h = buildModelHistory([
    mk('1', 'user', 'hello'),
    mk('2', 'assistant', 'hi there'),
  ]);
  assert(h.length === 2, 'plain: length 2');
  assert(h[0].role === 'user' && h[0].content === 'hello', 'plain: user preserved');
  assert(h[1].role === 'assistant' && h[1].content === 'hi there', 'plain: assistant preserved');
}

// 2. User reacted to Max's message → system note after the assistant message.
{
  const h = buildModelHistory([
    mk('1', 'user', 'tell me a joke'),
    mk('2', 'assistant', 'why did the chicken...', 'laugh'),
  ]);
  assert(h.length === 3, 'user-react: 3 entries (incl. system note)');
  const note = h[2];
  assert(note.role === 'system', 'user-react: note is system');
  assert(note.content.includes('The user reacted'), 'user-react: mentions the user reacted');
  assert(note.content.includes('😂'), 'user-react: includes emoji');
  assert(note.content.includes('your message above'), 'user-react: targets Max message');
}

// 3. Max reacted to the user's message → system note attributed to Max.
{
  const h = buildModelHistory([
    mk('1', 'user', 'i shipped it', 'love'),
    mk('2', 'assistant', 'nice work'),
  ]);
  const note = h.find(m => m.role === 'system');
  assert(!!note, 'ai-react: has a system note');
  assert(note!.content.includes('You (Max) reacted'), 'ai-react: attributed to Max');
  assert(note!.content.includes("the user's message above"), 'ai-react: targets user message');
  assert(note!.content.includes('❤️'), 'ai-react: includes love emoji');
}

// 4. Reply context is folded into the replying message.
{
  const h = buildModelHistory([
    mk('1', 'assistant', 'the deploy finished at 3pm'),
    mk('2', 'user', 'thanks!', null, '1'),
  ]);
  const replyMsg = h.find(m => m.role === 'user')!;
  assert(replyMsg.content.startsWith('[Reply to Max:'), 'reply: prefixed with quote of Max');
  assert(replyMsg.content.includes('the deploy finished'), 'reply: includes quoted snippet');
  assert(replyMsg.content.includes('thanks!'), 'reply: includes actual message');
}

// 5. Invalid reaction values are ignored (no system note).
{
  const h = buildModelHistory([
    mk('1', 'user', 'hi', 'banana'),
  ]);
  assert(h.length === 1, 'invalid-reaction: no system note added');
  assert(!h.some(m => m.role === 'system'), 'invalid-reaction: no system entries');
}

// 6. Reply to a non-existent message id is left as-is (no crash, no quote).
{
  const h = buildModelHistory([
    mk('2', 'user', 'orphan reply', null, 'does-not-exist'),
  ]);
  assert(h.length === 1, 'orphan-reply: single message');
  assert(h[0].content === 'orphan reply', 'orphan-reply: no quote prefix');
}

console.log(`\nbuildModelHistory: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
