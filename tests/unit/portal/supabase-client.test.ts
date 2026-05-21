import { describe, it, expect } from 'vitest';
import { getSupabaseClient } from '@/lib/supabase';

describe('getSupabaseClient', () => {
  it('returns same singleton instance on repeated calls', () => {
    const a = getSupabaseClient();
    const b = getSupabaseClient();
    expect(a).toBe(b);
  });

  it('exposes auth helpers', () => {
    const client = getSupabaseClient();
    expect(typeof client.auth.signInWithOAuth).toBe('function');
    expect(typeof client.auth.signOut).toBe('function');
    expect(typeof client.from).toBe('function');
  });
});
