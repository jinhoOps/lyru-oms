import { describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn(() => ({ marker: 'client' }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('supabaseClient', () => {
  it('creates a browser client from public Vite env values', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');

    const { createBrowserSupabaseClient } = await import('./supabaseClient');

    expect(createBrowserSupabaseClient()).toEqual({ marker: 'client' });
    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'sb_publishable_test', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  });

  it('fails clearly when Supabase public env values are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');

    const { getSupabaseConfig } = await import('./supabaseClient');

    expect(() => getSupabaseConfig()).toThrow('Supabase public configuration is missing.');
  });
});
