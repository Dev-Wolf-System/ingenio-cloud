'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { SECTIONS } from '@/lib/constants/sections';

interface CurrentUser {
  role: 'admin' | 'user' | null;
  allowedSections: string[];
  editSections: string[];
  loading: boolean;
}

export function useCurrentUser(): CurrentUser {
  const [state, setState] = useState<CurrentUser>({
    role: null,
    allowedSections: [],
    editSections: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const supabase = getSupabaseBrowser();

    async function load() {
      const { data } = await supabase.auth.getUser();
      if (cancelled) return;
      const meta = data.user?.user_metadata as
        | { role?: string; allowed_sections?: string[]; edit_sections?: string[] }
        | undefined;
      const role = meta?.role === 'admin' ? 'admin' : meta?.role === 'user' ? 'user' : null;
      const allowedSections = meta?.allowed_sections ?? SECTIONS.map((s) => s.key);
      const editSections = meta?.edit_sections ?? [];
      setState({ role, allowedSections, editSections, loading: false });
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
