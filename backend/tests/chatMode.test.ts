import { AssistantStreamFilter, parseAssistantControl } from '../src/services/chatMode';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

function eq(actual: unknown, expected: unknown, msg: string) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), `${msg} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
}

// Feed a full text to the filter in chunks of a fixed size to simulate SSE deltas.
function runChunked(text: string, size: number) {
  const f = new AssistantStreamFilter();
  let out = '';
  for (let i = 0; i < text.length; i += size) {
    out += f.push(text.slice(i, i + size));
  }
  out += f.end();
  return { content: out, control: f.getControl() };
}

// 1. Plain message, no control block.
{
  const r = parseAssistantControl('hey, what can i help with?');
  eq(r.content, 'hey, what can i help with?', 'plain: content preserved');
  eq(r.reaction, null, 'plain: no reaction');
  eq(r.isReply, false, 'plain: not a reply');
}

// 2. Reaction only (bare tapback).
{
  const r = parseAssistantControl('<<react:love>>');
  eq(r.content, '', 'bare tapback: empty content');
  eq(r.reaction, 'love', 'bare tapback: reaction parsed');
}

// 3. Reaction + message.
{
  const r = parseAssistantControl('<<react:laugh>>\n\nhaha good one');
  eq(r.content, 'haha good one', 'reaction+msg: content');
  eq(r.reaction, 'laugh', 'reaction+msg: reaction');
}

// 4. Reply + message.
{
  const r = parseAssistantControl('<<reply>>\n\nabout your earlier point...');
  eq(r.content, 'about your earlier point...', 'reply: content');
  eq(r.isReply, true, 'reply: flagged');
}

// 5. Both directives.
{
  const r = parseAssistantControl('<<react:emphasize>>\n<<reply>>\n\nyes exactly');
  eq(r.content, 'yes exactly', 'both: content');
  eq(r.reaction, 'emphasize', 'both: reaction');
  eq(r.isReply, true, 'both: reply');
}

// 6. Message that merely starts with "<" but is not a control block.
{
  const r = parseAssistantControl('<div> is an HTML tag');
  eq(r.content, '<div> is an HTML tag', 'lt-start: content preserved');
  eq(r.reaction, null, 'lt-start: no reaction');
}

// 7. Message starting with "<<" but not a valid directive.
{
  const r = parseAssistantControl('<<note>> this is not a directive');
  eq(r.content, '<<note>> this is not a directive', 'invalid-directive: content preserved');
  eq(r.reaction, null, 'invalid-directive: no reaction');
}

// 8. Invalid reaction name is not accepted.
{
  const r = parseAssistantControl('<<react:banana>>\n\nhello');
  eq(r.reaction, null, 'invalid-reaction: rejected');
  // The non-matching control line becomes content.
  assert(r.content.includes('hello'), 'invalid-reaction: message still present');
}

// 9. Chunk-boundary robustness: split at every size for a representative input.
{
  const input = '<<react:love>>\n<<reply>>\n\nhere is the answer\nwith two lines';
  for (let size = 1; size <= input.length; size++) {
    const r = runChunked(input, size);
    eq(r.content, 'here is the answer\nwith two lines', `chunked(size=${size}): content`);
    eq(r.control.reaction, 'love', `chunked(size=${size}): reaction`);
    eq(r.control.isReply, true, `chunked(size=${size}): reply`);
  }
}

// 10. Chunk-boundary robustness for a plain message split every way.
{
  const input = 'just a normal reply, nothing special here';
  for (let size = 1; size <= input.length; size++) {
    const r = runChunked(input, size);
    eq(r.content, input, `chunked-plain(size=${size}): content`);
    eq(r.control.reaction, null, `chunked-plain(size=${size}): no reaction`);
  }
}

// 11. Leading whitespace-only content after directive is trimmed once.
{
  const r = parseAssistantControl('<<react:like>>\n\n\nkeep this');
  assert(r.content.startsWith('keep this') || r.content.includes('keep this'), 'whitespace: content retained');
  eq(r.reaction, 'like', 'whitespace: reaction');
}

console.log(`\nchatMode parser: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
