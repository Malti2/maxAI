import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Palette, Brain, Trash2, LogOut, Check,
  Moon, Sun, Monitor, MessageCircle
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { MODELS } from '../lib/models';
import { PERSONALITIES, type PersonalityId } from '../lib/personalities';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useChatStore } from '../store/chatStore';
import api from '../lib/api';
import type { ModelId } from '../lib/models';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f97316', '#eab308', '#10b981', '#3b82f6',
];

type Section = 'profile' | 'appearance' | 'models' | 'data';

const SectionNav: React.FC<{ active: Section; onChange: (s: Section) => void }> = ({ active, onChange }) => {
  const items: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profil', icon: <User size={15} /> },
    { id: 'appearance', label: 'Erscheinungsbild', icon: <Palette size={15} /> },
    { id: 'models', label: 'KI & Modelle', icon: <Brain size={15} /> },
    { id: 'data', label: 'Daten', icon: <Trash2 size={15} /> },
  ];

  return (
    <nav className="p-2 space-y-0.5">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left"
          style={{
            background: active === item.id ? 'var(--accent-dim)' : 'transparent',
            color: active === item.id ? 'var(--accent)' : 'var(--text-2)',
            fontWeight: active === item.id ? 500 : 400,
          }}
          onMouseEnter={e => {
            if (active !== item.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)';
          }}
          onMouseLeave={e => {
            if (active !== item.id) (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
};

const SaveButton: React.FC<{ onClick: () => void; loading: boolean; saved: boolean }> = ({ onClick, loading, saved }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-50"
    style={{ background: 'linear-gradient(135deg, #5B5BD6, #7C3AED)', boxShadow: '0 2px 8px rgba(99,102,241,0.3)' }}
  >
    {loading ? (
      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : saved ? (
      <><Check size={14} /> Gespeichert</>
    ) : (
      'Speichern'
    )}
  </button>
);

const FieldLabel: React.FC<{ label: string; hint?: string }> = ({ label, hint }) => (
  <div className="mb-1.5">
    <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{label}</p>
    {hint && <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{hint}</p>}
  </div>
);

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout, refreshToken } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { setConversations } = useChatStore();

  const [section, setSection] = useState<Section>('profile');
  const [name, setName] = useState(user?.name || '');
  const [color, setColor] = useState(user?.avatarColor || AVATAR_COLORS[0]);
  const [model, setModel] = useState<ModelId>((user?.defaultModel as ModelId) || 'auto');
  const [personality, setPersonality] = useState<PersonalityId>((user?.personality as PersonalityId) || 'assistant');
  const [chatMode, setChatMode] = useState<boolean>(user?.chatMode ?? false);
  const [sysPrompt, setSysPrompt] = useState<string>(user?.systemPrompt ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings', {
        name: name || undefined,
        defaultModel: model,
        personality,
        chatMode,
        avatarColor: color,
        systemPrompt: sysPrompt || null,
      });
      updateUser(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try { await api.post('/auth/logout', { refreshToken }); } catch {}
    logout();
  };

  const handleDeleteAll = async () => {
    await api.delete('/chat/conversations');
    setConversations([]);
    setDeleteConfirm(false);
  };

  const inputClass = "w-full px-4 py-2.5 rounded-2xl text-sm focus:outline-none transition-colors";
  const inputStyle = {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    color: 'var(--text-1)',
  };

  const renderSection = () => {
    switch (section) {
      case 'profile':
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'var(--bg-3)' }}>
              <Avatar name={name || user?.name || null} color={color} size="lg" />
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{name || user?.name || 'Kein Name'}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{user?.email}</p>
              </div>
            </div>

            <div>
              <FieldLabel label="Name" />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Dein Name"
                className={inputClass}
                style={inputStyle}
                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
              />
            </div>

            <div>
              <FieldLabel label="Avatar-Farbe" />
              <div className="flex gap-3 flex-wrap">
                {AVATAR_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className="w-8 h-8 rounded-full transition-all relative"
                    style={{ background: c, transform: color === c ? 'scale(1.15)' : 'scale(1)' }}
                  >
                    {color === c && (
                      <div className="absolute inset-0 rounded-full flex items-center justify-center">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <SaveButton onClick={save} loading={saving} saved={saved} />
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-3">
            <FieldLabel label="Theme" />
            {[
              { value: 'light', label: 'Hell', icon: <Sun size={16} />, desc: 'Helles Interface' },
              { value: 'dark', label: 'Dunkel', icon: <Moon size={16} />, desc: 'Dunkles Interface' },
              { value: 'system', label: 'System', icon: <Monitor size={16} />, desc: 'Folgt dem Systemmodus' },
            ].map(({ value, label, icon, desc }) => (
              <button
                key={value}
                onClick={() => setTheme(value as 'light' | 'dark' | 'system')}
                className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left"
                style={{
                  borderColor: theme === value ? 'var(--accent)' : 'var(--border)',
                  background: theme === value ? 'var(--accent-dim)' : 'var(--bg)',
                }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }}>
                  {icon}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{desc}</p>
                </div>
                {theme === value && <Check size={15} style={{ color: 'var(--accent)' }} />}
              </button>
            ))}
          </div>
        );

      case 'models':
        return (
          <div className="space-y-5">
            {/* Chat Mode toggle */}
            <div>
              <FieldLabel label="Chat Mode" hint="Send messages while Max is responding" />
              <button
                onClick={() => setChatMode(v => !v)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left"
                style={{
                  borderColor: chatMode ? '#6366f1' + '60' : 'var(--border)',
                  background: chatMode ? '#6366f1' + '08' : 'var(--bg)',
                }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: chatMode ? '#6366f115' : 'var(--bg-3)', color: chatMode ? '#6366f1' : 'var(--text-3)' }}
                >
                  <MessageCircle size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Chat Mode</span>
                    <span
                      className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: chatMode ? '#6366f118' : 'var(--bg-3)', color: chatMode ? '#6366f1' : 'var(--text-3)' }}
                    >
                      {chatMode ? 'On' : 'Off'}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    Messages sent while Max is responding are queued and delivered together — Max replies naturally to all of them at once.
                  </p>
                </div>
                {/* Toggle switch */}
                <div
                  className="relative shrink-0 w-10 h-6 rounded-full transition-all duration-200"
                  style={{ background: chatMode ? '#6366f1' : 'var(--border-2)' }}
                >
                  <div
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
                    style={{ left: chatMode ? '22px' : '4px' }}
                  />
                </div>
              </button>
            </div>

            <div>
              <FieldLabel label="Persönlichkeit" hint="Bestimmt Tonfall und Stil von Max" />
              <div className="space-y-2 mt-2">
                {PERSONALITIES.map(p => {
                  const Icon = p.icon;
                  const selected = personality === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setPersonality(p.id)}
                      className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left"
                      style={{
                        borderColor: selected ? p.color + '60' : 'var(--border)',
                        background: selected ? p.color + '08' : 'var(--bg)',
                      }}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${p.color}15`, color: p.color }}>
                        <Icon size={17} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
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
            </div>

            <div>
              <FieldLabel label="Standardmodell" hint="Wird für neue Chats verwendet" />
              <div className="space-y-2 mt-2">
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id as ModelId)}
                    className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left"
                    style={{
                      borderColor: model === m.id ? m.color + '60' : 'var(--border)',
                      background: model === m.id ? m.color + '08' : 'var(--bg)',
                    }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: `${m.color}15`, color: m.color }}>
                      {m.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{m.name}</span>
                        <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: `${m.color}18`, color: m.color }}>{m.badge}</span>
                      </div>
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>{m.description}</p>
                    </div>
                    {model === m.id && <Check size={14} style={{ color: m.color }} />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel label="Systemanweisung" hint="Zusätzliche Anweisung, die zur gewählten Persönlichkeit hinzukommt" />
              <textarea
                value={sysPrompt}
                onChange={e => setSysPrompt(e.target.value)}
                placeholder="z.B. Antworte immer auf Deutsch. Sei präzise und direkt. Du bist ein erfahrener Softwareentwickler…"
                rows={4}
                className="w-full px-4 py-3 rounded-2xl text-sm focus:outline-none resize-none transition-colors"
                style={{ ...inputStyle, lineHeight: '1.6' }}
                onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
                onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
              />
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>
                {sysPrompt.length} / 2000 Zeichen
              </p>
            </div>

            <SaveButton onClick={save} loading={saving} saved={saved} />
          </div>
        );

      case 'data':
        return (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-1)' }}>Chat-Verlauf löschen</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
                Alle Konversationen und Nachrichten werden unwiderruflich gelöscht.
              </p>
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="px-3.5 py-2 rounded-xl text-sm font-medium text-red-500 transition-colors"
                  style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.1)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.06)'}
                >
                  Verlauf löschen
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDeleteAll}
                    className="px-3.5 py-2 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors"
                  >
                    Ja, löschen
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="px-3.5 py-2 rounded-xl text-sm font-medium transition-colors"
                    style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }}
                  >
                    Abbrechen
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-1)' }}>Abmelden</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>
                Du wirst auf allen Geräten abgemeldet.
              </p>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
              >
                <LogOut size={14} /> Abmelden
              </button>
            </div>

            <div className="p-4 rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Account</p>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{user?.email}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div
        className="flex items-center gap-3 px-4 py-3.5 shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-xl transition-colors"
          style={{ color: 'var(--text-3)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-2)'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <ArrowLeft size={17} />
        </button>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Einstellungen</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-52 shrink-0 overflow-y-auto" style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-2)' }}>
          <SectionNav active={section} onChange={setSection} />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-md">
            <h2 className="text-base font-semibold mb-5" style={{ color: 'var(--text-1)' }}>
              {section === 'profile' ? 'Profil'
                : section === 'appearance' ? 'Erscheinungsbild'
                : section === 'models' ? 'KI & Modelle'
                : 'Daten & Datenschutz'}
            </h2>
            {renderSection()}
          </div>
        </div>
      </div>
    </div>
  );
};
