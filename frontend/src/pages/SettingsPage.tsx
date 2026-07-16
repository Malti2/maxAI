import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Palette, Brain, Trash2, LogOut, Check,
  Moon, Sun, Monitor, MessageCircle, Volume2, ShieldCheck,
} from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { AdminPanel } from '../components/admin/AdminPanel';
import { MODELS } from '../lib/models';
import { PERSONALITIES, type PersonalityId } from '../lib/personalities';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useChatStore } from '../store/chatStore';
import { toast } from '../store/toastStore';
import { playReceive, setSoundEnabled as applySoundEnabled } from '../lib/sounds';
import api from '../lib/api';
import type { ModelId } from '../lib/models';

const AVATAR_COLORS = [
  '#5b57e0', '#7c6cf0', '#bf5af2', '#e5484d',
  '#dd8a2b', '#e0b21f', '#30a46c', '#3aa0d8',
];

type Section = 'profile' | 'appearance' | 'models' | 'data' | 'admin';

const SectionNav: React.FC<{ active: Section; onChange: (s: Section) => void; isAdmin: boolean }> = ({ active, onChange, isAdmin }) => {
  const items: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
    { id: 'models', label: 'AI & Models', icon: <Brain size={16} /> },
    { id: 'data', label: 'Data', icon: <Trash2 size={16} /> },
    ...(isAdmin ? [{ id: 'admin' as Section, label: 'Admin', icon: <ShieldCheck size={16} /> }] : []),
  ];
  return (
    <nav className="p-2 space-y-0.5">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left"
          style={{
            background: active === item.id ? 'var(--accent-soft)' : 'transparent',
            color: active === item.id ? 'var(--accent)' : 'var(--text-2)',
            fontWeight: active === item.id ? 600 : 450,
          }}
          onMouseEnter={(e) => { if (active !== item.id) (e.currentTarget as HTMLElement).style.background = 'var(--bg-3)'; }}
          onMouseLeave={(e) => { if (active !== item.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          {item.icon}
          {item.label}
        </button>
      ))}
    </nav>
  );
};

const Toggle: React.FC<{ on: boolean }> = ({ on }) => (
  <div
    className="relative shrink-0 w-[46px] h-[28px] rounded-full transition-all duration-200"
    style={{ background: on ? '#30a46c' : 'var(--border-2)' }}
  >
    <div
      className="absolute top-[2px] w-6 h-6 rounded-full bg-white shadow transition-all duration-200"
      style={{ left: on ? '20px' : '2px' }}
    />
  </div>
);

const SaveButton: React.FC<{ onClick: () => void; loading: boolean; saved: boolean }> = ({ onClick, loading, saved }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
    style={{ background: 'var(--accent)' }}
  >
    {loading ? (
      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : saved ? (<><Check size={14} /> Saved</>) : 'Save'}
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
  const [soundEnabled, setSoundEnabled] = useState<boolean>(user?.soundEnabled ?? true);
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
        soundEnabled,
        avatarColor: color,
        systemPrompt: sysPrompt || null,
      });
      updateUser(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error('Could not save your settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try { await api.post('/auth/logout', { refreshToken }); } catch { /* ignore */ }
    logout();
  };

  const handleDeleteAll = async () => {
    try {
      await api.delete('/chat/conversations');
      setConversations([]);
      toast.success('Chat history deleted.');
    } catch {
      toast.error('Could not delete history.');
    } finally {
      setDeleteConfirm(false);
    }
  };

  const inputClass = 'w-full px-4 py-2.5 rounded-2xl text-sm focus:outline-none transition-colors';
  const inputStyle = { background: 'var(--bg)', border: '1px solid var(--border-2)', color: 'var(--text-1)' };

  const OptionCard: React.FC<{
    selected: boolean; color: string; icon: React.ReactNode; title: string; badge?: string; desc: string; onClick: () => void;
  }> = ({ selected, color, icon, title, badge, desc, onClick }) => (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left"
      style={{ borderColor: selected ? color : 'var(--border)', background: selected ? `${color}12` : 'var(--bg)' }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base" style={{ background: `${color}1f`, color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{title}</span>
          {badge && <span className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: `${color}22`, color }}>{badge}</span>}
        </div>
        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-3)' }}>{desc}</p>
      </div>
      {selected && <Check size={15} style={{ color }} className="shrink-0" />}
    </button>
  );

  const renderSection = () => {
    switch (section) {
      case 'profile':
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: 'var(--bg-3)' }}>
              <Avatar name={name || user?.name || null} color={color} size="lg" />
              <div>
                <p className="font-medium text-sm" style={{ color: 'var(--text-1)' }}>{name || user?.name || 'No name'}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{user?.email}</p>
              </div>
            </div>

            <div>
              <FieldLabel label="Name" />
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
                className={inputClass} style={inputStyle}
                onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
                onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)')}
              />
            </div>

            <div>
              <FieldLabel label="Avatar color" />
              <div className="flex gap-3 flex-wrap">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c} onClick={() => setColor(c)}
                    className="w-9 h-9 rounded-full transition-all relative"
                    style={{ background: c, transform: color === c ? 'scale(1.12)' : 'scale(1)', boxShadow: color === c ? `0 0 0 2px var(--bg), 0 0 0 4px ${c}` : 'none' }}
                    aria-label={`Color ${c}`}
                  >
                    {color === c && <Check size={13} className="absolute inset-0 m-auto text-white" strokeWidth={3} />}
                  </button>
                ))}
              </div>
            </div>

            <SaveButton onClick={save} loading={saving} saved={saved} />
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel label="Theme" />
              <div className="space-y-2.5">
                {[
                  { value: 'light', label: 'Light', icon: <Sun size={18} />, desc: 'Light interface' },
                  { value: 'dark', label: 'Dark', icon: <Moon size={18} />, desc: 'Dark interface' },
                  { value: 'system', label: 'System', icon: <Monitor size={18} />, desc: 'Follows your system setting' },
                ].map(({ value, label, icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value as 'light' | 'dark' | 'system')}
                    className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all text-left"
                    style={{ borderColor: theme === value ? 'var(--accent)' : 'var(--border)', background: theme === value ? 'var(--accent-soft)' : 'var(--bg)' }}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }}>{icon}</div>
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{desc}</p>
                    </div>
                    {theme === value && <Check size={16} style={{ color: 'var(--accent)' }} />}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <FieldLabel label="Sound" />
              <button
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  applySoundEnabled(next);
                  if (next) playReceive();
                }}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left"
                style={{ borderColor: soundEnabled ? 'var(--accent)' : 'var(--border)', background: soundEnabled ? 'var(--accent-soft)' : 'var(--bg)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: soundEnabled ? 'var(--accent-soft)' : 'var(--bg-3)', color: soundEnabled ? 'var(--accent)' : 'var(--text-3)' }}>
                  <Volume2 size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Message sounds</span>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>Play a subtle cue when you send and when Max replies.</p>
                </div>
                <Toggle on={soundEnabled} />
              </button>
            </div>

            <SaveButton onClick={save} loading={saving} saved={saved} />
          </div>
        );

      case 'models':
        return (
          <div className="space-y-5">
            <div>
              <FieldLabel label="Chat Mode" hint="Send messages while Max is responding" />
              <button
                onClick={() => setChatMode((v) => !v)}
                className="w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left"
                style={{ borderColor: chatMode ? 'var(--accent)' : 'var(--border)', background: chatMode ? 'var(--accent-soft)' : 'var(--bg)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: chatMode ? 'var(--accent-soft)' : 'var(--bg-3)', color: chatMode ? 'var(--accent)' : 'var(--text-3)' }}>
                  <MessageCircle size={17} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Chat Mode</span>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>
                    Queue messages while Max is replying, and unlock tapbacks &amp; replies — just like a real chat.
                  </p>
                </div>
                <Toggle on={chatMode} />
              </button>
            </div>

            <div>
              <FieldLabel label="Personality" hint="Controls Max's tone and style" />
              <div className="space-y-2 mt-2">
                {PERSONALITIES.map((p) => {
                  const Icon = p.icon;
                  return (
                    <OptionCard
                      key={p.id} selected={personality === p.id} color={p.color}
                      icon={<Icon size={17} />} title={p.name} badge={p.tagline} desc={p.description}
                      onClick={() => setPersonality(p.id)}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <FieldLabel label="Default model" hint="Used for new chats" />
              <div className="space-y-2 mt-2">
                {MODELS.map((m) => (
                  <OptionCard
                    key={m.id} selected={model === m.id} color={m.color}
                    icon={m.icon} title={m.name} badge={m.badge} desc={m.description}
                    onClick={() => setModel(m.id as ModelId)}
                  />
                ))}
              </div>
            </div>

            <div>
              <FieldLabel label="System instruction" hint="An extra instruction layered on top of the chosen personality" />
              <textarea
                value={sysPrompt}
                onChange={(e) => setSysPrompt(e.target.value)}
                placeholder="e.g. Always answer in English. Be precise and direct. You are an experienced software engineer…"
                rows={4}
                className="w-full px-4 py-3 rounded-2xl text-sm focus:outline-none resize-none transition-colors"
                style={{ ...inputStyle, lineHeight: '1.6' }}
                onFocus={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)')}
                onBlur={(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border-2)')}
              />
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-3)' }}>{sysPrompt.length} / 2000 characters</p>
            </div>

            <SaveButton onClick={save} loading={saving} saved={saved} />
          </div>
        );

      case 'data':
        return (
          <div className="space-y-3">            <div className="p-4 rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-1)' }}>Delete chat history</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>All conversations and messages will be permanently deleted.</p>
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="px-3.5 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: 'color-mix(in srgb, var(--danger) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 22%, transparent)', color: 'var(--danger)' }}
                >
                  Delete history
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={handleDeleteAll} className="px-3.5 py-2 rounded-xl text-sm font-medium text-white" style={{ background: 'var(--danger)' }}>Yes, delete</button>
                  <button onClick={() => setDeleteConfirm(false)} className="px-3.5 py-2 rounded-xl text-sm font-medium" style={{ background: 'var(--bg-3)', color: 'var(--text-2)' }}>Cancel</button>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-1)' }}>Log out</p>
              <p className="text-xs mb-3" style={{ color: 'var(--text-3)' }}>You will be signed out on this device.</p>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border)' }}
              >
                <LogOut size={14} /> Log out
              </button>
            </div>

            <div className="p-4 rounded-2xl" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>Account</p>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{user?.email}</p>
            </div>
          </div>
        );

      case 'admin':
        return <AdminPanel />;
    }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--bg)' }}>
      <div className="glass flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 pr-2 py-1 rounded-lg transition-colors"
          style={{ color: 'var(--accent)' }}
          aria-label="Back"
        >
          <ArrowLeft size={19} />
        </button>
        <h1 className="text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-52 shrink-0 overflow-y-auto" style={{ borderRight: '1px solid var(--border)', background: 'var(--bg-2)' }}>
          <SectionNav active={section} onChange={setSection} isAdmin={!!user?.isAdmin} />
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className={section === 'admin' ? 'max-w-xl' : 'max-w-md'}>
            <h2 className="text-lg font-bold mb-5 tracking-tight" style={{ color: 'var(--text-1)' }}>
              {section === 'profile' ? 'Profile' : section === 'appearance' ? 'Appearance' : section === 'models' ? 'AI & Models' : section === 'admin' ? 'Admin' : 'Data & Privacy'}
            </h2>
            {renderSection()}
          </div>
        </div>
      </div>
    </div>
  );
};
