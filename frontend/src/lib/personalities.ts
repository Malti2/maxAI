import {
  MessageCircle, Sparkles, Briefcase, Target, GraduationCap, Palette, type LucideIcon,
} from 'lucide-react';

export type PersonalityId = 'casual' | 'assistant' | 'professional' | 'precise' | 'teacher' | 'creative';

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
    color: '#5b57e0',
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'Formal & precise',
    description: 'Objective, structured and business-ready — ideal for work.',
    icon: Briefcase,
    color: '#0ea5e9',
  },
  {
    id: 'precise',
    name: 'Precise',
    tagline: 'Short & factual',
    description: 'Answer first, no filler. Assumptions and gaps stated openly.',
    icon: Target,
    color: '#30a46c',
  },
  {
    id: 'teacher',
    name: 'Tutor',
    tagline: 'Step by step',
    description: 'Explains in comprehensible steps and ends with an example.',
    icon: GraduationCap,
    color: '#bf5af2',
  },
  {
    id: 'creative',
    name: 'Creative',
    tagline: 'Vivid & playful',
    description: 'Images, comparisons and a voice of its own — still accurate.',
    icon: Palette,
    color: '#e0b21f',
  },
];

export function getPersonality(id?: string | null): PersonalityConfig {
  return PERSONALITIES.find(p => p.id === id) ?? PERSONALITIES[1];
}
