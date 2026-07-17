import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../lib/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

import api from '../lib/api';
import { AuthPage } from '../pages/AuthPage';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthPage registration toggle', () => {
  it('hides sign-up when the server disables registration', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { allowRegistration: false } });
    render(<AuthPage />);

    // Wait for the config to load and the UI to settle on sign-in only.
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Sign up' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows sign-up when registration is allowed', async () => {
    (api.get as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { allowRegistration: true } });
    render(<AuthPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Sign up' }).length).toBeGreaterThan(0);
    });
  });
});
