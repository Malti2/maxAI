export type ModelId = 'lite' | 'pro' | 'beast' | 'auto';

export interface ModelConfig {
  id: ModelId;
  name: string;
  badge: string;
  description: string;
  color: string;
  icon: string;
}

// A cohesive, vivid system-style palette for the model tiers.
export const MODELS: ModelConfig[] = [
  {
    id: 'auto',
    name: 'Max',
    badge: 'Auto',
    description: 'Automatically picks the best model',
    color: '#30a46c', // green
    icon: '✦',
  },
  {
    id: 'lite',
    name: 'Max',
    badge: 'Lite',
    description: 'Fast & efficient for everyday tasks',
    color: '#3aa0d8', // sky
    icon: '◈',
  },
  {
    id: 'pro',
    name: 'Max',
    badge: 'Pro',
    description: 'Powerful for complex tasks',
    color: '#5b57e0', // iris
    icon: '◆',
  },
  {
    id: 'beast',
    name: 'Max',
    badge: 'Beast',
    description: 'Maximum performance for the most demanding tasks',
    color: '#dd8a2b', // amber
    icon: '⬡',
  },
];

export function getModel(id: ModelId): ModelConfig {
  return MODELS.find((m) => m.id === id) || MODELS[0];
}
