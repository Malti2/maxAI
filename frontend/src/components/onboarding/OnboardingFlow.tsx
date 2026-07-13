import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ArrowRight, MessageCircle } from 'lucide-react';
import { MODELS } from '../../lib/models';
import { PERSONALITIES, DEFAULT_PERSONALITY, type PersonalityId } from '../../lib/personalities';
import { useAuthStore } from '../../store/authStore';
import api from '../../lib/api';

const AVATAR_COLORS = [
  '#0a84ff', '#5e5ce6', '#bf5af2', '#ff375f',
  '#ff9f0a', '#ffd60a', '#30d158', '#64d2ff',
];

interface OnboardingFlowProps {
  onComplete: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({ onComplete }) => {
  const { user, updateUser } = useAuthStore();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name || '');
  const [selectedModel, setSelectedModel] = useState(user?.defaultModel || 'auto');
  const [selectedColor, setSelectedColor] = useState(user?.avatarColor || AVATAR_COLORS[0]);
  const [personality, setPersonality] = useState<PersonalityId>((user?.personality as PersonalityId) || DEFAULT_PERSONALITY);
  const [chatMode, setChatMode] = useState<boolean>(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [direction, setDirection] = useState(1);

  const STEPS = [
    { id: 'welcome' },
    { id: 'name' },
    { id: 'personality' },
    { id: 'color' },
    { id: 'model' },
    { id: 'chatmode' },
    { id: 'system' },
    { id: 'done' },
  ] as const;

  const TOTAL = STEPS.length;
  const stepId = STEPS[step].id;
  const progress = (step / (TOTAL - 1)) * 100;

  const next = () => { setDirection(1); setStep(s => Math.min(s + 1, TOTAL - 1)); };
  const back = () => { setDirection(-1); setStep(s => Math.max(s - 1, 0)); };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings', {
        name: name || undefined,
        defaultModel: selectedModel,
        personality,
        chatMode,
        avatarColor: selectedColor,
        systemPrompt: systemPrompt || null,
        onboardingDone: true,
      });
      updateUser(data);
      onComplete();
    } finally {
      setSaving(false);
    }
  };

  const canProceed = stepId !== 'name' || name.length >= 2;

  const variants = {
    enter: (d: number) => ({ opacity: 0, x: d > 0 ? 28 : -28 }),
    center: { opacity: 1, x: 0 },
    exit: (d: number) => ({ opacity: 0, x: d > 0 ? -28 : 28 }),
  };

  const renderContent = () => {
    switch (stepId) {
      case 'welcome':
        return (
          <div className="text-center space-y-4">
            <div
              className="w-20 h-20 rounded-[24px] mx-auto flex items-center justify-center brand-gradient"
              style={{ boxShadow: '0 12px 40px rgba(10,132,255,0.4)' }}
            >
              <span className="text-white text-3xl font-bold">M</span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
                Welcome to maxAI
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                Your personal AI assistant with multiple models –<br />
                from lightning-fast to high-performance.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 flex-wrap pt-2">
              {MODELS.map(m => (
                <span
                  key={m.id}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                  style={{ background: `${m.color}12`, color: m.color, border: `1px solid ${m.color}25` }}
                >
                  <span>{m.icon}</span>{m.badge}
                </span>
              ))}
            </div>
          </div>
        );

      case 'name':
        return (
          <div className="space-y-4 w-full">
            <p className="text-sm text-center" style={{ color: 'var(--text-2)' }}>
              So Max can address you personally.
            </p>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && canProceed && next()}
              placeholder="e.g. Malte"
              autoFocus
              className="w-full px-4 py-3 rounded-2xl text-base text-center focus:outline-none transition-all"
              style={{
                background: 'var(--bg-3)',
                border: '2px solid var(--border)',
                color: 'var(--text-1)',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            />
          </div>
        );

      case 'personality':
        return (
          <div className="space-y-2 w-full">
            <p className="text-sm text-center mb-3" style={{ color: 'var(--text-2)' }}>
              How should Max talk to you? <span style={{ color: 'var(--text-3)' }}>(Changeable anytime)</span>
            </p>
            {PERSONALITIES.map(p => {
              const Icon = p.icon;
              const selected = personality === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPersonality(p.id)}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left"
                  style={{
                    borderColor: selected ? p.color + '70' : 'var(--border)',
                    background: selected ? p.color + '0a' : 'var(--bg-3)',
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${p.color}15`, color: p.color }}>
                    <Icon size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{p.name}</span>
                      <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: `${p.color}18`, color: p.color }}>{p.tagline}</span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{p.description}</p>
                  </div>
                  {selected && <Check size={14} style={{ color: p.color }} className="shrink-0" />}
                </button>
              );
            })}
          </div>
        );

      case 'color':
        return (
          <div className="flex flex-col items-center gap-5">
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>Choose a color for your avatar.</p>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg transition-all duration-300"
              style={{ background: selectedColor, boxShadow: `0 8px 24px ${selectedColor}50` }}
            >
              {name ? name[0].toUpperCase() : 'M'}
            </div>
            <div className="flex gap-3 flex-wrap justify-center">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className="w-9 h-9 rounded-full transition-all relative"
                  style={{
                    background: c,
                    transform: selectedColor === c ? 'scale(1.2)' : 'scale(1)',
                    boxShadow: selectedColor === c ? `0 0 0 3px var(--bg), 0 0 0 5px ${c}` : 'none',
                  }}
                >
                  {selectedColor === c && (
                    <Check size={12} className="absolute inset-0 m-auto text-white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>
        );

      case 'model':
        return (
          <div className="space-y-2 w-full">
            <p className="text-sm text-center mb-3" style={{ color: 'var(--text-2)' }}>
              Choose your default model for new chats.
            </p>
            {MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left"
                style={{
                  borderColor: selectedModel === m.id ? m.color + '70' : 'var(--border)',
                  background: selectedModel === m.id ? m.color + '0a' : 'var(--bg-3)',
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: `${m.color}15`, color: m.color }}>
                  {m.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{m.name}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: `${m.color}18`, color: m.color }}>{m.badge}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{m.description}</p>
                </div>
                {selectedModel === m.id && <Check size={14} style={{ color: m.color }} />}
              </button>
            ))}
          </div>
        );

      case 'chatmode':
        return (
          <div className="space-y-4 w-full">
            <p className="text-sm text-center" style={{ color: 'var(--text-2)' }}>
              Want to chat more naturally? <span style={{ color: 'var(--text-3)' }}>(Changeable anytime)</span>
            </p>
            <button
              onClick={() => setChatMode(v => !v)}
              className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left"
              style={{
                borderColor: chatMode ? 'var(--accent)' : 'var(--border)',
                background: chatMode ? 'var(--accent-dim)' : 'var(--bg-3)',
              }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: chatMode ? 'var(--accent-dim)' : 'var(--bg-3)', color: chatMode ? 'var(--accent)' : 'var(--text-3)' }}
              >
                <MessageCircle size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Chat Mode</span>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold"
                    style={{ background: chatMode ? 'var(--accent-dim)' : 'var(--bg-3)', color: chatMode ? 'var(--accent)' : 'var(--text-3)' }}
                  >
                    {chatMode ? 'On' : 'Off'}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                  Messages sent while Max is responding are queued and delivered together — Max replies naturally to all of them at once.
                </p>
              </div>
              <div
                className="relative shrink-0 w-10 h-6 rounded-full transition-all duration-200"
                style={{ background: chatMode ? '#30d158' : 'var(--border-2)' }}
              >
                <div
                  className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                  style={{ left: chatMode ? '22px' : '4px' }}
                />
              </div>
            </button>
          </div>
        );

      case 'system':
        return (
          <div className="space-y-3 w-full">
            <p className="text-sm text-center" style={{ color: 'var(--text-2)' }}>
              Give Max a global behavior instruction. <span style={{ color: 'var(--text-3)' }}>(Optional)</span>
            </p>
            <textarea
              value={systemPrompt}
              onChange={e => setSystemPrompt(e.target.value)}
              placeholder="e.g. Always answer in English. Be precise and direct. You are an experienced developer…"
              rows={4}
              className="w-full px-4 py-3 rounded-2xl text-sm focus:outline-none resize-none transition-all"
              style={{
                background: 'var(--bg-3)',
                border: '2px solid var(--border)',
                color: 'var(--text-1)',
                lineHeight: '1.65',
              }}
              onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
              onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
            />
            <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
              Changeable anytime in settings.
            </p>
          </div>
        );

      case 'done':
        return (
          <div className="text-center space-y-3">
            <div className="text-5xl">🎉</div>
            <div>
              <h3 className="text-xl font-semibold" style={{ color: 'var(--text-1)' }}>
                All set{name ? `, ${name.split(' ')[0]}` : ''}!
              </h3>
              <p className="text-sm mt-1.5" style={{ color: 'var(--text-2)' }}>
                Max is ready for you.<br />
                You can adjust every setting anytime.
              </p>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--bg)' }}
    >
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-15 pointer-events-none" style={{ background: 'radial-gradient(circle, #0a84ff, transparent)' }} />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ background: 'radial-gradient(circle, #5e5ce6, transparent)' }} />

      <div
        className="relative w-full max-w-md rounded-3xl overflow-hidden"
        style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
      >
        <div className="h-1" style={{ background: 'var(--bg-3)' }}>
          <div className="h-full transition-all duration-500 brand-gradient" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-8">
          <p className="text-center text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--accent)' }}>
            Step {step + 1} of {TOTAL}
          </p>

          <div className="min-h-[300px] flex items-center justify-center">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
                className="w-full flex flex-col items-center"
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={back}
              disabled={step === 0}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors disabled:opacity-0"
              style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--border)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'}
            >
              Back
            </button>

            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className="rounded-full transition-all duration-300"
                  style={{
                    width: i === step ? '20px' : '6px',
                    height: '6px',
                    background: i === step ? 'var(--accent)' : i < step ? 'var(--accent)' : 'var(--border-2)',
                    opacity: i < step ? 0.4 : 1,
                  }}
                />
              ))}
            </div>

            {step < TOTAL - 1 ? (
              <button
                onClick={next}
                disabled={!canProceed}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 brand-gradient"
              >
                {step === 0 ? "Let's go" : 'Next'}
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={handleComplete}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 brand-gradient"
              >
                {saving ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : 'Done 🚀'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
