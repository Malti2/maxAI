import React, { useEffect, useState } from 'react';
import { Check, Loader2, Plug, ShieldCheck, RefreshCw } from 'lucide-react';
import { MODELS } from '../../lib/models';
import { toast } from '../../store/toastStore';
import api from '../../lib/api';

type ModelKey = 'lite' | 'pro' | 'beast';
const MODEL_KEYS: ModelKey[] = ['lite', 'pro', 'beast'];

interface AdminModelView {
  baseURL: string;
  model: string;
  apiKeySet: boolean;
  apiKeyHint: string;
  configured: boolean;
}
interface AdminConfig {
  models: Record<ModelKey, AdminModelView>;
}
type TestState = Record<ModelKey, { ok: boolean; error?: string } | 'loading' | undefined>;

const badge = (m: ModelKey) => MODELS.find((x) => x.badge.toLowerCase() === m)!;

export const AdminPanel: React.FC = () => {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [baseURLs, setBaseURLs] = useState<Record<ModelKey, string>>({ lite: '', pro: '', beast: '' });
  const [models, setModels] = useState<Record<ModelKey, string>>({ lite: '', pro: '', beast: '' });
  const [apiKeys, setApiKeys] = useState<Record<ModelKey, string>>({ lite: '', pro: '', beast: '' });
  const [stats, setStats] = useState<{ users: number; conversations: number; messages: number } | null>(null);
  const [tests, setTests] = useState<TestState>({ lite: undefined, pro: undefined, beast: undefined });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const hydrate = (c: AdminConfig) => {
    setConfig(c);
    setBaseURLs({ lite: c.models.lite.baseURL, pro: c.models.pro.baseURL, beast: c.models.beast.baseURL });
    setModels({ lite: c.models.lite.model, pro: c.models.pro.model, beast: c.models.beast.model });
    setApiKeys({ lite: '', pro: '', beast: '' });
  };

  useEffect(() => {
    Promise.all([api.get('/admin/config'), api.get('/admin/stats')])
      .then(([cfg, st]) => { hydrate(cfg.data); setStats(st.data); })
      .catch(() => toast.error('Could not load admin configuration.'))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const m of MODEL_KEYS) {
        payload[m] = {
          baseURL: baseURLs[m],
          model: models[m],
          apiKey: apiKeys[m].trim() || (config?.models[m].apiKeySet ? undefined : null),
        };
      }
      const { data } = await api.put('/admin/config', { models: payload });
      hydrate(data);
      setSaved(true);
      toast.success('Configuration saved.');
      setTimeout(() => setSaved(false), 2500);
    } catch {
      toast.error('Could not save configuration.');
    } finally {
      setSaving(false);
    }
  };

  const testAll = async () => {
    setTests({ lite: 'loading', pro: 'loading', beast: 'loading' });
    try {
      const { data } = await api.post('/admin/config/test', {});
      setTests(data);
      const okCount = MODEL_KEYS.filter((m) => (data[m] as { ok: boolean })?.ok).length;
      toast[okCount === MODEL_KEYS.length ? 'success' : 'info'](`${okCount}/${MODEL_KEYS.length} models reachable.`);
    } catch {
      setTests({ lite: undefined, pro: undefined, beast: undefined });
      toast.error('Connection test failed.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin" size={20} style={{ color: 'var(--text-3)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 p-4 rounded-2xl" style={{ background: 'var(--accent-dim)' }}>
        <ShieldCheck size={20} style={{ color: 'var(--accent)' }} className="shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-1)' }}>Admin area</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
            Connect the AI provider behind Max. maxAI works with any endpoint that speaks the standard
            Chat Completions API — set a base URL, model name and key per tier. Changes take effect
            immediately, no redeploy needed. API keys are stored encrypted and never shown again.
          </p>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: 'Users', value: stats.users },
            { label: 'Chats', value: stats.conversations },
            { label: 'Messages', value: stats.messages },
          ].map((s) => (
            <div key={s.label} className="p-3.5 rounded-2xl text-center" style={{ background: 'var(--bg-3)' }}>
              <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--text-1)' }}>{s.value.toLocaleString()}</p>
              <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {MODEL_KEYS.map((m) => {
        const b = badge(m);
        const view = config?.models[m];
        const t = tests[m];
        return (
          <div key={m} className="p-4 rounded-2xl space-y-3" style={{ border: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: `${b.color}1f`, color: b.color }}>{b.icon}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Max {b.badge}</span>
              {view?.configured ? (
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: '#30d15822', color: '#30d158' }}>Configured</span>
              ) : (
                <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: 'var(--bg-3)', color: 'var(--text-3)' }}>Not set</span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              <input
                value={baseURLs[m]}
                onChange={(e) => setBaseURLs((s) => ({ ...s, [m]: e.target.value }))}
                placeholder="API base URL (e.g. https://api.openai.com/v1)"
                className="w-full px-3.5 py-2 rounded-xl text-[13px] focus:outline-none"
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
              />
              <input
                value={models[m]}
                onChange={(e) => setModels((s) => ({ ...s, [m]: e.target.value }))}
                placeholder="Model name (e.g. gpt-4o)"
                className="w-full px-3.5 py-2 rounded-xl text-[13px] focus:outline-none"
                style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
              />
              <div className="relative">
                <input
                  type="password"
                  value={apiKeys[m]}
                  onChange={(e) => setApiKeys((s) => ({ ...s, [m]: e.target.value }))}
                  placeholder={view?.apiKeySet ? `Key set (${view.apiKeyHint}) — leave blank to keep` : 'API key'}
                  className="w-full px-3.5 py-2 rounded-xl text-[13px] focus:outline-none pr-10"
                  style={{ background: 'var(--bg-2)', border: '1px solid var(--border-2)', color: 'var(--text-1)' }}
                  autoComplete="new-password"
                />
                {view?.apiKeySet && !apiKeys[m] && (
                  <button
                    onClick={() => {
                      if (confirm(`Clear API key for Max ${badge(m).badge}?`)) {
                        api.put('/admin/config', {
                          models: { [m]: { apiKey: null } }
                        }).then(({ data }) => {
                          hydrate(data);
                          toast.success('API key cleared.');
                        }).catch(() => toast.error('Could not clear key.'));
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider opacity-50 hover:opacity-100 transition-opacity"
                    style={{ color: '#ff3b30' }}
                    title="Clear key"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {t && t !== 'loading' && (
              <p className="text-[12px]" style={{ color: t.ok ? '#30d158' : '#ff3b30' }}>
                {t.ok ? '✓ Reachable' : `✗ ${t.error}`}
              </p>
            )}
            {t === 'loading' && (
              <p className="text-[12px] flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                <Loader2 size={12} className="animate-spin" /> Testing…
              </p>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <><Check size={14} /> Saved</> : 'Save configuration'}
        </button>
        <button
          onClick={testAll}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
          style={{ background: 'var(--bg-3)', color: 'var(--text-2)', border: '1px solid var(--border-2)' }}
        >
          <Plug size={14} /> Test connections
        </button>
        <button
          onClick={() => { setLoading(true); api.get('/admin/config').then(({ data }) => hydrate(data)).finally(() => setLoading(false)); }}
          className="p-2 rounded-xl transition-colors"
          style={{ background: 'var(--bg-3)', color: 'var(--text-3)' }}
          title="Reload"
          aria-label="Reload configuration"
        >
          <RefreshCw size={14} />
        </button>
      </div>
    </div>
  );
};
