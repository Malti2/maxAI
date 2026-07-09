import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Palette, Brain, Moon, Sun, Monitor,
  Trash2, LogOut, Save, ChevronRight
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { ModelSelector } from '../components/ui/ModelSelector';
import { MODELS } from '../lib/models';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { useChatStore } from '../store/chatStore';
import api from '../lib/api';
import { ModelId } from '../lib/models';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f97316',
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444',
];

type Section = 'profile' | 'appearance' | 'models' | 'data';

export const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, updateUser, logout, refreshToken } = useAuthStore();
  const { theme, setTheme } = useThemeStore();
  const { setConversations } = useChatStore();

  const [activeSection, setActiveSection] = useState<Section>('profile');
  const [name, setName] = useState(user?.name || '');
  const [selectedColor, setSelectedColor] = useState(user?.avatarColor || AVATAR_COLORS[0]);
  const [selectedModel, setSelectedModel] = useState<ModelId>((user?.defaultModel as ModelId) || 'auto');
  const [systemPrompt, setSystemPrompt] = useState<string>(user?.systemPrompt ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings', {
        name: name || undefined,
        defaultModel: selectedModel,
        avatarColor: selectedColor,
        systemPrompt: systemPrompt || null,
      });
      updateUser(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    logout();
  };

  const handleDeleteAll = async () => {
    await api.delete('/chat/conversations');
    setConversations([]);
    setDeleteConfirm(false);
  };

  const navItems = [
    { id: 'profile' as Section, label: 'Profil', icon: User },
    { id: 'appearance' as Section, label: 'Erscheinungsbild', icon: Palette },
    { id: 'models' as Section, label: 'KI-Modelle', icon: Brain },
    { id: 'data' as Section, label: 'Daten & Datenschutz', icon: Trash2 },
  ];

  const renderSection = () => {
    switch (activeSection) {
      case 'profile':
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Avatar name={name || user?.name || null} color={selectedColor} size="lg" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{user?.name || 'Kein Name'}</p>
                <p className="text-sm text-gray-400">{user?.email}</p>
              </div>
            </div>

            <Input
              label="Name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Dein Name"
            />

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-2">
                Avatar-Farbe
              </label>
              <div className="flex gap-2.5 flex-wrap">
                {AVATAR_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`w-8 h-8 rounded-full transition-all ${selectedColor === color ? 'scale-110 ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600' : 'hover:scale-105'}`}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>

            <Button onClick={save} loading={saving}>
              {saved ? '✓ Gespeichert' : 'Speichern'}
            </Button>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Theme</p>
            {[
              { value: 'light', label: 'Hell', icon: Sun },
              { value: 'dark', label: 'Dunkel', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ].map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setTheme(value as any)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                  theme === value
                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                }`}
              >
                <Icon size={18} className="text-gray-600 dark:text-gray-300" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{label}</span>
                {theme === value && (
                  <div className="ml-auto w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        );

      case 'models':
        return (
          <div className="space-y-6">
            <div>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Standardmodell</p>
              <p className="text-xs text-gray-400 mb-3">Wird für neue Chats verwendet, wenn du kein Modell auswählst</p>
              <div className="space-y-2">
                {MODELS.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedModel(m.id as ModelId)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition-all text-left ${
                      selectedModel === m.id
                        ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30'
                        : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0" style={{ background: `${m.color}15`, color: m.color }}>
                      {m.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-sm text-gray-700 dark:text-gray-200">{m.name}</span>
                        <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${m.color}20`, color: m.color }}>{m.badge}</span>
                      </div>
                      <p className="text-xs text-gray-400">{m.description}</p>
                    </div>
                    {selectedModel === m.id && (
                      <div className="ml-auto w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block mb-1">
                Systemanweisung
              </label>
              <p className="text-xs text-gray-400 mb-2">Gibt Max eine globale Verhaltensanweisung für alle Chats</p>
              <textarea
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                placeholder="z.B. Antworte immer auf Deutsch. Sei präzise und direkt."
                rows={4}
                className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 resize-none"
              />
            </div>

            <Button onClick={save} loading={saving}>
              {saved ? '✓ Gespeichert' : 'Speichern'}
            </Button>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Chat-Verlauf löschen</h3>
              <p className="text-sm text-gray-400 mb-3">Alle Konversationen und Nachrichten werden unwiderruflich gelöscht.</p>
              {!deleteConfirm ? (
                <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(true)}>
                  Verlauf löschen
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button variant="danger" size="sm" onClick={handleDeleteAll}>Ja, wirklich löschen</Button>
                  <Button variant="secondary" size="sm" onClick={() => setDeleteConfirm(false)}>Abbrechen</Button>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
              <h3 className="font-medium text-gray-800 dark:text-gray-200 mb-1">Abmelden</h3>
              <p className="text-sm text-gray-400 mb-3">Du wirst aus deinem Konto abgemeldet.</p>
              <Button variant="secondary" size="sm" onClick={handleLogout} className="gap-2">
                <LogOut size={14} /> Abmelden
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-400"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-base font-semibold text-gray-900 dark:text-white">Einstellungen</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Nav */}
        <div className="w-52 border-r border-gray-100 dark:border-gray-800 p-3 shrink-0">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors text-left ${
                activeSection === id
                  ? 'bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-black/4 dark:hover:bg-white/4'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-lg">
            {renderSection()}
          </div>
        </div>
      </div>
    </div>
  );
};
