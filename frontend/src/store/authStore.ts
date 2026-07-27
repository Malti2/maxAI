import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name: string | null;
  onboardingDone: boolean;
  defaultModel: string;
  personality: string;
  chatMode: boolean;
  soundEnabled: boolean;
  avatarColor: string;
  systemPrompt: string | null;
  webSearch: boolean;
  webSearchSources: number;
  webSearchReadPages: boolean;
  temperature: number | null;
  maxTokens: number | null;
  historyLimit: number;
  reasoningEffort: string | null;
  isAdmin: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (user: Partial<User>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      setAuth: (user, accessToken, refreshToken) => set({ user, accessToken, refreshToken }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      updateUser: (updates) => set((state) => ({
        user: state.user ? { ...state.user, ...updates } : null,
      })),
      logout: () => set({ user: null, accessToken: null, refreshToken: null }),
    }),
    {
      name: 'max-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    }
  )
);
