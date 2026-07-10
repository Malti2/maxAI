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
    tagline: 'Locker & direkt',
    description: 'Wie eine Nachricht von einem cleveren Freund – kleingeschrieben, kurz, ohne Floskeln.',
    icon: MessageCircle,
    color: '#f59e0b',
  },
  {
    id: 'assistant',
    name: 'Assistant',
    tagline: 'Ausgewogen & hilfreich',
    description: 'Freundlich und klar mit sauberer Formatierung. Die empfohlene Standardeinstellung.',
    icon: Sparkles,
    color: '#6366f1',
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'Formell & präzise',
    description: 'Sachlich, strukturiert und geschäftstauglich – ideal fürs Büro.',
    icon: Briefcase,
    color: '#0ea5e9',
  },
];

export function getPersonality(id?: string | null): PersonalityConfig {
  return PERSONALITIES.find(p => p.id === id) ?? PERSONALITIES[1];
}
