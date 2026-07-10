import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, Sparkles } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

type Mode = 'login' | 'register';

export const AuthPage: React.FC = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post(
        mode === 'login' ? '/auth/login' : '/auth/register',
        mode === 'login' ? { email, password } : { email, password, name }
      );
      setAuth(data.user, data.accessToken, data.refreshToken);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Ein Fehler ist aufgetreten');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}
    >
      {/* Background blobs */}
      <div
        className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none opacity-30 dark:opacity-20"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
      />
      <div
        className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none opacity-20 dark:opacity-10"
        style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }}
      />

      <div className="relative w-full max-w-[400px]">
        {/* Brand */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-xl"
            style={{ background: 'linear-gradient(135deg, #5B5BD6, #7C3AED)', boxShadow: '0 8px 32px rgba(99,102,241,0.35)' }}
          >
            <span className="text-white text-xl font-bold">M</span>
          </div>
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-1)', letterSpacing: '-0.02em' }}>
            Willkommen bei maxAI
          </h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--text-2)' }}>
            Dein persönlicher KI-Assistent
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl p-6"
          style={{
            background: 'var(--bg-2)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xl)',
          }}
        >
          {/* Tab switcher */}
          <div
            className="flex p-1 rounded-2xl mb-6"
            style={{ background: 'var(--bg-3)' }}
          >
            {(['login', 'register'] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                style={mode === m ? {
                  background: 'var(--bg)',
                  color: 'var(--text-1)',
                  boxShadow: 'var(--shadow-sm)',
                } : {
                  color: 'var(--text-3)',
                  background: 'transparent',
                }}
              >
                {m === 'login' ? 'Anmelden' : 'Registrieren'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              onSubmit={handleSubmit}
              className="space-y-3.5"
            >
              {mode === 'register' && (
                <div className="relative">
                  <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Dein Name"
                    autoFocus
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm focus:outline-none transition-colors"
                    style={{
                      background: 'var(--bg)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-1)',
                    }}
                    onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
                    onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                  />
                </div>
              )}

              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@beispiel.de"
                  required
                  autoFocus={mode === 'login'}
                  className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-1)',
                  }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
                  onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                />
              </div>

              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Passwort"
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-2xl text-sm focus:outline-none transition-colors"
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-1)',
                  }}
                  onFocus={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
                  onBlur={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3.5 py-2.5 rounded-xl text-sm text-red-500" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-2xl text-sm font-semibold text-white transition-all mt-1 disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #5B5BD6, #7C3AED)', boxShadow: '0 2px 12px rgba(99,102,241,0.3)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Einen Moment…
                  </span>
                ) : (
                  mode === 'login' ? 'Anmelden' : 'Konto erstellen'
                )}
              </button>
            </motion.form>
          </AnimatePresence>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-3)' }}>
          {mode === 'login' ? 'Noch kein Konto?' : 'Bereits registriert?'}{' '}
          <button
            onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
            className="font-medium transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            {mode === 'login' ? 'Jetzt registrieren' : 'Anmelden'}
          </button>
        </p>

        {/* Feature pills */}
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          {['Max Lite', 'Max Pro', 'Max Beast', 'Auto'].map((f, i) => (
            <span
              key={f}
              className="text-[11px] px-2.5 py-1 rounded-full font-medium"
              style={{ background: 'var(--bg-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}
            >
              {f}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
