export type ReactionType =
  | 'love'
  | 'like'
  | 'dislike'
  | 'laugh'
  | 'emphasize'
  | 'question';

export interface ReactionConfig {
  id: ReactionType;
  emoji: string;
  label: string;
}

// Order here is the order the tapback picker renders in.
export const REACTIONS: ReactionConfig[] = [
  { id: 'love', emoji: '❤️', label: 'Love' },
  { id: 'like', emoji: '👍', label: 'Like' },
  { id: 'dislike', emoji: '👎', label: 'Dislike' },
  { id: 'laugh', emoji: '😂', label: 'Haha' },
  { id: 'emphasize', emoji: '‼️', label: 'Emphasize' },
  { id: 'question', emoji: '❓', label: 'Question' },
];

export function getReaction(id?: string | null): ReactionConfig | undefined {
  if (!id) return undefined;
  return REACTIONS.find(r => r.id === id);
}
