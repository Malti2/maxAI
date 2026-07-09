import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { MODELS } from '../../lib/models';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
];

interface StepProps {
  onNext: () => void;
  onBack?: () => void;
  isLast?: boolean;
}

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { user, updateUser } = useAuthStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name || '');
  const [selectedModel, setSelectedModel] = useState(user?.defaultModel || 'auto');
  const [selectedColor, setSelectedColor] = useState(user?.avatarColor || AVATAR_COLORS[0]);
  const [systemPrompt, setSystemPrompt] = useState(user?.systemPrompt || '');
  const [saving, setSaving] = useState(false);

  const steps = [
    { title: 'Willkommen bei Max', subtitle: 'Dein KI-Assistent, der mitdenkt' },
    { title: 'Wie heißt du?', subtitle: 'Damit Max dich persönlich ansprechen kann' },
    { title: 'Deine Farbe', subtitle: 'Wähle eine Akzentfarbe für deinen Avatar' },
    { title: 'Dein Standardmodell', subtitle: 'Wähle, welches Modell Max standardmäßig nutzt' },
    { title: 'Systemanweisung', subtitle: 'Sage Max, wie es sich verhalten soll (optional)' },
    { title: 'Alles bereit!', subtitle: 'Du kannst jetzt loslegen' },
  ];

  const progress = ((step) / (steps.length - 1)) * 100;

  const handleComplete = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings', {
        name: name || undefined,
        defaultModel: selectedModel,
        avatarColor: selectedColor,
        systemPrompt: systemPrompt || undefined,
        onboardingDone: true,
      });
      updateUser(data);
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const variants = {
    enter: { opacity: 0, x: 40 },
    center: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-500/30">
              <span className="text-white text-4xl font-bold">M</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
              Max ist dein persönlicher KI-Assistent mit mehreren Modellen –
              von blitzschnell bis hochleistungsfähig. Lass uns kurz alles einrichten.
            </p>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4 max-w-sm mx-auto">
            <Input
              label="Dein Name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Malte"
              autoFocus
            />
          </div>
        );

      case 2:
        return (
          <div className="flex flex-col items-center gap-4">
            <div
              className="w-20 h-20 rounded-3xl flex items-center justify-center text-white text-2xl font-bold shadow-lg transition-all duration-300"
              style={{ background: selectedColor }}
            >
              {name ? name[0].toUpperCase() : 'M'}
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              {AVATAR_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-full transition-all ${selectedColor === color ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : 'hover:scale-105'}`}
                  style={{ background: color }}
                />
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="grid grid-cols-1 gap-3 max-w-sm mx-auto w-full">
            {MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${
                  selectedModel === m.id
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                  style={{ background: `${m.color}15`, color: m.color }}
                >
                  {m.icon}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-gray-700 dark:text-gray-200 text-sm">{m.name}</span>
                    <span
                      className="px-1.5 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: `${m.color}20`, color: m.color }}
                    >
                      {m.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{m.description}</p>
                </div>
                {selectedModel === m.id && (
                  <div className="ml-auto">
                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        );

      case 4:
        return (
          <div className="max-w-sm mx-auto w-full space-y-3">
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="z.B. Antworte immer auf Deutsch. Sei präzise und direkt. Du bist ein erfahrener Softwareentwickler..."
              rows={5}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
            />
            <p className="text-xs text-gray-400 text-center">
              Diese Anweisung gilt für alle Chats. Du kannst sie jederzeit in den Einstellungen ändern.
            </p>
          </div>
        );

      case 5:
        return (
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
              Alles ist eingerichtet, {name || 'du'}! Max steht dir jetzt zur Verfügung.
              Du kannst alle Einstellungen jederzeit anpassen.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-900 rounded-3xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-800">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-8">
          {/* Step header */}
          <div className="text-center mb-8">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wider mb-1">
              Schritt {step + 1} von {steps.length}
            </p>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
              {steps[step].title}
            </h2>
            <p className="text-gray-400 mt-1 text-sm">{steps[step].subtitle}</p>
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="min-h-[200px] flex items-center justify-center"
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            <Button
              variant="ghost"
              onClick={() => step > 0 && setStep(s => s - 1)}
              disabled={step === 0}
            >
              Zurück
            </Button>

            {step < steps.length - 1 ? (
              <Button onClick={() => setStep(s => s + 1)}>
                {step === 0 ? 'Los geht\'s' : 'Weiter'} →
              </Button>
            ) : (
              <Button onClick={handleComplete} loading={saving}>
                Fertig 🚀
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
