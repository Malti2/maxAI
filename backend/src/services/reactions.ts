// Tapback (message reaction) definitions shared across the backend.
//
// A tapback is a lightweight, iMessage-style reaction that can be attached to a
// single message. In Chat Mode the user can react to Max's messages, and Max
// can react to the user's messages. Each message carries at most one tapback.

export type ReactionType =
  | 'love'
  | 'like'
  | 'dislike'
  | 'laugh'
  | 'emphasize'
  | 'question';

// Order matters: this is the order the picker renders in the UI.
export const REACTION_TYPES: ReactionType[] = [
  'love',
  'like',
  'dislike',
  'laugh',
  'emphasize',
  'question',
];

export const REACTIONS: Record<ReactionType, { emoji: string; name: string }> = {
  love: { emoji: '❤️', name: 'love' },
  like: { emoji: '👍', name: 'like' },
  dislike: { emoji: '👎', name: 'dislike' },
  laugh: { emoji: '😂', name: 'laugh' },
  emphasize: { emoji: '‼️', name: 'emphasize' },
  question: { emoji: '❓', name: 'question' },
};

export function isReactionType(value: unknown): value is ReactionType {
  return typeof value === 'string' && (REACTION_TYPES as string[]).includes(value);
}

// Human-readable form used when telling the model about a reaction,
// e.g. "❤️ (love)".
export function describeReaction(type: string): string {
  if (!isReactionType(type)) return type;
  const r = REACTIONS[type];
  return `${r.emoji} (${r.name})`;
}
