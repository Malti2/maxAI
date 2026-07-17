import { describe, it, expect } from 'vitest';
import { getGreeting } from '../lib/greeting';

describe('smoke', () => {
  it('greeting works', () => {
    const g = getGreeting('Malte', new Date('2026-07-17T09:00:00'));
    expect(g.hero).toContain('Malte');
    expect(g.timeOfDay).toBe('morning');
  });
});
