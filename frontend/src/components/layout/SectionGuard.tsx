'use client';

import { useSectionAccess } from '@/lib/hooks/useSectionAccess';

export function SectionGuard({ section }: { section: string }) {
  useSectionAccess(section);
  return null;
}
