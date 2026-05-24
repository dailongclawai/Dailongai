import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/lib/auth-context';

vi.mock('@/lib/supabase', () => {
  return {
    getSupabaseClient: () => ({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      })),
    }),
  };
});

function Probe() {
  const { session, loading } = useAuth();
  return <div data-testid="probe">{loading ? 'loading' : session ? 'authed' : 'anon'}</div>;
}

describe('AuthProvider', () => {
  it('starts loading then resolves to anon when no session', async () => {
    const { getByTestId } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    expect(getByTestId('probe').textContent).toBe('loading');
    await waitFor(() => expect(getByTestId('probe').textContent).toBe('anon'));
  });
});
