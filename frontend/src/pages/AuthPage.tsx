import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { Spark } from '../components/ui/Spark';
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
  const [allowRegistration, setAllowRegistration] = useState(true);
  const { setAuth } = useAuthStore();

  // The server can disable self-service sign-up; hide it when it does.
  useEffect(() => {
    api.get('/auth/config')
      .then(({ data }) => setAllowRegistration(data.allowRegistration !== false))
      .catch(() => { /* keep the default (allowed) if the check fails */ });
  }, []);

  useEffect(() => {
    if (!allowRegistration && mode === 'register') setMode('login');
  }, [allowRegistration, mode]);

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
      setError(msg || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = { background: 'var(--surface)', border: '1px solid var(--border-2)', color: 'var(--text-1)' };
  const focusOn = (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.style.borderColor = 'var(--accent)');
  const focusOff = (e: React.FocusEvent<HTMLElement>) => (e.currentTarget.style.borderColor = 'var(--border-2)');

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="relative w-full max-w-[400px]">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Spark size={44} />
          </div>
          <h1 className="display text-[30px]" style={{ color: 'var(--text-1)' }}>
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-2)' }}>
            {mode === 'login' ? 'Sign in to continue to maxAI' : 'Join maxAI and meet Max'}
          </p>
        </div>

        <div className="rounded-3xl p-6" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
          {allowRegistration && (
            <div className="flex p-1 rounded-2xl mb-6" style={{ background: 'var(--bg-3)' }}>
              {(['login', 'register'] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); }}
                  className="flex-1 py-2 rounded-xl text-sm font-medium transition-all"
                  style={mode === m
                    ? { background: 'var(--surface)', color: 'var(--text-1)', boxShadow: 'var(--shadow-sm)' }
                    : { color: 'var(--text-3)', background: 'transparent' }}
                >
                  {m === 'login' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }} onSubmit={handleSubmit} className="space-y-3.5"
            >
              {mode === 'register' && (
                <div className="relative">
                  <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus
                    className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm focus:outline-none transition-colors" style={fieldStyle}
                    onFocus={focusOn} onBlur={focusOff}
                  />
                </div>
              )}

              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                <input
                  type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com"
                  required autoFocus={mode === 'login'}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm focus:outline-none transition-colors" style={fieldStyle}
                  onFocus={focusOn} onBlur={focusOff}
                />
              </div>

              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Password (min. 8 characters)' : 'Password'} required
                  className="w-full pl-10 pr-10 py-3 rounded-2xl text-sm focus:outline-none transition-colors" style={fieldStyle}
                  onFocus={focusOn} onBlur={focusOff}
                />
                <button
                  type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="px-3.5 py-2.5 rounded-xl text-sm" style={{ background: 'color-mix(in srgb, var(--danger) 9%, transparent)', border: '1px solid color-mix(in srgb, var(--danger) 22%, transparent)', color: 'var(--danger)' }}>
                      {error}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit" disabled={loading}
                className="w-full py-3 rounded-2xl text-sm font-semibold transition-all mt-1 disabled:opacity-50"
                style={{ background: 'var(--accent)', color: 'var(--accent-text)' }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Just a moment…
                  </span>
                ) : (mode === 'login' ? 'Sign in' : 'Create account')}
              </button>
            </motion.form>
          </AnimatePresence>
        </div>

        {allowRegistration && (
          <p className="text-center text-sm mt-4" style={{ color: 'var(--text-3)' }}>
            {mode === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}
            <button
              onClick={() => { setMode((m) => (m === 'login' ? 'register' : 'login')); setError(''); }}
              className="font-semibold transition-colors" style={{ color: 'var(--accent)' }}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        )}
      </div>
    </div>
  );
};
