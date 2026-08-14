import { getSupabaseBrowser } from '@/lib/supabase/client';

export async function authHeaders(): Promise<HeadersInit> {
  const { data } = await getSupabaseBrowser().auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
