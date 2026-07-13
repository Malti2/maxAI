import { MessageCircle, Sparkles, Briefcase, type LucideIcon } from 'lucide-react';

export type PersonalityId = 'casual' | 'assistant' | 'professional';

export interface PersonalityConfig {
  id: PersonalityId;
  name: string;
  tagline: string;
  description: string;
  icon: LucideIcon;
  color: string;
}

export const DEFAULT_PERSONALITY: PersonalityId = 'assistant';

export const PERSONALITIES: PersonalityConfig[] = [
  {
    id: 'casual',
    name: 'Casual',
    tagline: 'Relaxed & direct',
    description: 'Like a text from a clever friend — lowercase, short, no fluff.',
    icon: MessageCircle,
    color: '#f59e0b',
  },
  {
    id: 'assistant',
    name: 'Assistant',
    tagline: 'Balanced & helpful',
    description: 'Friendly and clear with clean formatting. The recommended default.',
    icon: Sparkles,
    color: '#0a84ff',
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'Formal & precise',
    description: 'Objective, structured and business-ready — ideal for work.',
    icon: Briefcase,
    color: '#0ea5e9',
  },
];

export function getPersonality(id?: string | null): PersonalityConfig {
  return PERSONALITIES.find(p => p.id === id) ?? PERSONALITIES[1];
}
