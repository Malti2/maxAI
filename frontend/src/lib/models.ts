export type ModelId = 'lite' | 'pro' | 'beast' | 'auto';

export interface ModelConfig {
  id: ModelId;
  name: string;
  badge: string;
  description: string;
  color: string;
  gradient: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

export const MODELS: ModelConfig[] = [
  {
    id: 'auto',
    name: 'Max',
    badge: 'Auto',
    description: 'Wählt automatisch das beste Modell',
    color: '#10b981',
    gradient: 'from-emerald-400 to-teal-500',
    textColor: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    icon: '✦',
  },
  {
    id: 'lite',
    name: 'Max',
    badge: 'Lite',
    description: 'Schnell & effizient für alltägliche Aufgaben',
    color: '#3b82f6',
    gradient: 'from-blue-400 to-sky-500',
    textColor: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: '◈',
  },
  {
    id: 'pro',
    name: 'Max',
    badge: 'Pro',
    description: 'Leistungsstark für komplexe Aufgaben',
    color: '#8b5cf6',
    gradient: 'from-violet-500 to-purple-600',
    textColor: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/30',
    icon: '◆',
  },
  {
    id: 'beast',
    name: 'Max',
    badge: 'Beast',
    description: 'Maximale Leistung für anspruchsvollste Aufgaben',
    color: '#f97316',
    gradient: 'from-orange-500 to-red-500',
    textColor: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    icon: '⬡',
  },
];

export function getModel(id: ModelId): ModelConfig {
  return MODELS.find(m => m.id === id) || MODELS[0];
}
