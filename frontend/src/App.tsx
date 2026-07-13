import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthPage } from './pages/AuthPage';
import { ChatPage } from './pages/ChatPage';
import { SettingsPage } from './pages/SettingsPage';
import { AppLayout } from './components/layout/AppLayout';
import { OnboardingFlow } from './components/onboarding/OnboardingFlow';
import { Toaster } from './components/ui/Toaster';
import { useAuthStore } from './store/authStore';
import { useThemeStore, applyTheme } from './store/themeStore';
import { setSoundEnabled } from './lib/sounds';

const queryClient = new QueryClient();

function AppRoutes() {
  const { user, updateUser } = useAuthStore();
  const { theme } = useThemeStore();

  useEffect(() => {
    applyTheme(theme);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (theme === 'system') applyTheme('system'); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Keep the sound engine in sync with the user's preference.
  useEffect(() => {
    setSoundEnabled(user?.soundEnabled ?? true);
  }, [user?.soundEnabled]);

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  if (!user.onboardingDone) {
    return <OnboardingFlow onComplete={() => updateUser({ onboardingDone: true })} />;
  }

  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/chat" replace />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="chat/:id" element={<ChatPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
        <Toaster />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
