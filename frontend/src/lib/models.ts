export type ModelId = 'lite' | 'pro' | 'beast' | 'auto';

export interface ModelConfig {
  id: ModelId;
  name: string;
  badge: string;
  description: string;
  color: string;
  icon: string;
}

// Colours follow the iOS system palette for a cohesive, Apple-like feel.
export const MODELS: ModelConfig[] = [
  {
    id: 'auto',
    name: 'Max',
    badge: 'Auto',
    description: 'Automatically picks the best model',
    color: '#30d158', // iOS green
    icon: '✦',
  },
  {
    id: 'lite',
    name: 'Max',
    badge: 'Lite',
    description: 'Fast & efficient for everyday tasks',
    color: '#5ac8fa', // iOS light blue
    icon: '◈',
  },
  {
    id: 'pro',
    name: 'Max',
    badge: 'Pro',
    description: 'Powerful for complex tasks',
    color: '#5e5ce6', // iOS indigo
    icon: '◆',
  },
  {
    id: 'beast',
    name: 'Max',
    badge: 'Beast',
    description: 'Maximum performance for the most demanding tasks',
    color: '#ff9f0a', // iOS orange
    icon: '⬡',
  },
];

export function getModel(id: ModelId): ModelConfig {
  return MODELS.find((m) => m.id === id) || MODELS[0];
}
