'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from './useCurrentUser';

export function useSectionAccess(section: string) {
  const router = useRouter();
  const { role, allowedSections, loading } = useCurrentUser();

  useEffect(() => {
    if (loading) return;
    if (role === 'admin') return;
    if (!allowedSections.includes(section)) {
      router.push('/');
    }
  }, [loading, role, allowedSections, section, router]);
}
