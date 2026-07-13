// Chat Mode control protocol.
//
// When Chat Mode is enabled, Max may optionally emit a short control block at
// the very start of a response to (a) add a tapback reaction to the user's
// latest message and/or (b) mark the whole response as a reply to that
// message — mirroring what a person can do in a real chat.
//
// The control block, if present, is the first thing in the response. Each
// directive sits on its own line and looks like:
//
//     <<react:love>>
//     <<reply>>
//
// followed by the visible message. This module both describes the protocol to
// the model and parses/strips it from the response so the directives never
// leak into the rendered text.

import { isReactionType, REACTION_TYPES, REACTIONS, describeReaction, type ReactionType } from './reactions';

export interface AssistantControl {
  reaction: ReactionType | null;
  isReply: boolean;
}

export type StoredMessage = {
  id: string;
  role: string;
  content: string;
  reaction: string | null;
  replyToId: string | null;
};

export type ApiMessage = { role: 'user' | 'assistant' | 'system'; content: string };

// Turn stored messages into the message list sent to the model, folding in
// tapback and reply context so Max is aware of them — this is how "the model
// gets the info that the user reacted to a message" and how it understands
// reply threads.
export function buildModelHistory(messages: StoredMessage[]): ApiMessage[] {
  const byId = new Map(messages.map(m => [m.id, m]));
  const out: ApiMessage[] = [];

  for (const m of messages) {
    if (m.role !== 'user' && m.role !== 'assistant' && m.role !== 'system') continue;

    let content = m.content;

    // Fold reply context into the message the model sees.
    if (m.replyToId && byId.has(m.replyToId)) {
      const target = byId.get(m.replyToId)!;
      const who = target.role === 'assistant' ? 'Max' : 'the user';
      const snippet = target.content.replace(/\s+/g, ' ').slice(0, 140);
      content = `[Reply to ${who}: "${snippet}"]\n\n${content}`;
    }

    out.push({ role: m.role as ApiMessage['role'], content });

    // Announce any tapback attached to this message.
    if (m.reaction && isReactionType(m.reaction)) {
      const who = m.role === 'assistant' ? 'The user' : 'You (Max)';
      const target = m.role === 'assistant' ? 'your message above' : "the user's message above";
      out.push({
        role: 'system',
        content: `[Tapback] ${who} reacted with ${describeReaction(m.reaction)} to ${target}.`,
      });
    }
  }

  return out;
}

// Fold reply context into a single message's content (used for the just-sent
// message, which is not yet part of stored history).
export function foldReplyContext(target: StoredMessage, content: string): string {
  const who = target.role === 'assistant' ? 'Max' : 'the user';
  const snippet = target.content.replace(/\s+/g, ' ').slice(0, 140);
  return `[Reply to ${who}: "${snippet}"]\n\n${content}`;
}

const REACT_RE = /^<<react:([a-z]+)>>$/;
const REPLY_RE = /^<<reply>>$/;

// Could this line (possibly still being streamed) be the beginning of a
// control directive? Used by the streaming filter to decide whether to keep
// buffering or flush the text as visible content.
function couldBeControlPrefix(line: string): boolean {
  // Any prefix of "<<react:...>>" or "<<reply>>".
  const candidates = ['<<react:', '<<reply>>'];
  // Accept a partial "<<" and partial "<<r", etc.
  const partials = ['<', '<<', '<<r', '<<re'];
  if (partials.includes(line)) return true;
  if (line.startsWith('<<react:')) return true;
  if ('<<reply>>'.startsWith(line)) return true;
  for (const c of candidates) {
    if (c.startsWith(line)) return true;
  }
  return false;
}

function parseControlLine(line: string): { reaction?: ReactionType; isReply?: boolean } | null {
  const react = line.match(REACT_RE);
  if (react && isReactionType(react[1])) return { reaction: react[1] as ReactionType };
  if (REPLY_RE.test(line)) return { isReply: true };
  return null;
}

// Incremental filter that consumes streamed deltas, extracts a leading control
// block, and yields only the visible text. Directives are held back so they
// are never shown to the user, even mid-stream.
export class AssistantStreamFilter {
  private buffer = '';
  private headerDone = false;
  private control: AssistantControl = { reaction: null, isReply: false };

  // Feed a streamed chunk; returns the visible text to emit (may be empty).
  push(delta: string): string {
    if (this.headerDone) return delta;

    this.buffer += delta;

    let emit = '';
    // Resolve as many complete leading control lines as possible.
    while (true) {
      const nl = this.buffer.indexOf('\n');

      if (nl === -1) {
        // No complete line yet. If what we have can't be a control prefix,
        // the header is over and the buffer is visible content.
        if (!couldBeControlPrefix(this.buffer)) {
          this.headerDone = true;
          emit += this.stripLeadingBlank(this.buffer);
          this.buffer = '';
        }
        return emit;
      }

      const line = this.buffer.slice(0, nl);
      const parsed = parseControlLine(line.trim());
      if (parsed) {
        // Consume this control line and keep scanning.
        if (parsed.reaction) this.control.reaction = parsed.reaction;
        if (parsed.isReply) this.control.isReply = true;
        this.buffer = this.buffer.slice(nl + 1);
        continue;
      }

      // First non-control line → header is finished. Everything from here on
      // (including this line) is visible content.
      this.headerDone = true;
      emit += this.stripLeadingBlank(this.buffer);
      this.buffer = '';
      return emit;
    }
  }

  // Flush any buffered remainder once the stream ends.
  end(): string {
    if (this.headerDone) return '';
    // Whatever remains is either leftover content or an unterminated final
    // control line. Try to parse it as a control line first.
    const trimmed = this.buffer.trim();
    const parsed = trimmed ? parseControlLine(trimmed) : null;
    if (parsed) {
      if (parsed.reaction) this.control.reaction = parsed.reaction;
      if (parsed.isReply) this.control.isReply = true;
      this.buffer = '';
      this.headerDone = true;
      return '';
    }
    const remaining = this.stripLeadingBlank(this.buffer);
    this.buffer = '';
    this.headerDone = true;
    return remaining;
  }

  getControl(): AssistantControl {
    return this.control;
  }

  private stripLeadingBlank(s: string): string {
    // Only strip the first single newline that follows the control block.
    // If the model sent multiple newlines, keep the rest.
    return s.replace(/^\n/, '');
  }
}

// Non-streaming convenience parser (used in tests and as a fallback).
export function parseAssistantControl(raw: string): AssistantControl & { content: string } {
  const filter = new AssistantStreamFilter();
  let content = filter.push(raw);
  content += filter.end();
  const control = filter.getControl();
  return { ...control, content };
}

// The instructions appended to the system prompt when Chat Mode is on.
export function chatModeInstructions(): string {
  const reactionList = REACTION_TYPES.map(t => `${REACTIONS[t].emoji} ${t}`).join(', ');
  return `# Chat Mode
You are chatting in a live, message-by-message style, like a real chat app.

Tapbacks: you may react to the user's most recent message with a single tapback instead of, or in addition to, replying. Available reactions: ${reactionList}.
Replies: you may mark your message as a direct reply to the user's most recent message when it makes the thread clearer.

To do either, put an optional control block at the VERY START of your response, each directive on its own line, then a blank line, then your message:
<<react:love>>
<<reply>>

Rules:
- The control block is optional. Omit it entirely for a normal message.
- Use at most one <<react:...>> directive, and only a reaction name from the list above.
- A bare tapback (a <<react:...>> with no message after it) is a valid, natural response — use it when a reaction alone is the right reply.
- Never mention this control syntax to the user and never use it anywhere except the very start of your response.`;
}
