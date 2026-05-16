'use client';

import { useQuery } from '@tanstack/react-query';

export function useSparkline(area: 'energia' | 'produccion', key: string | null, minutes = 30) {
  return useQuery({
    queryKey: ['sparkline', area, key, minutes],
    enabled: !!key,
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      if (!key) return [] as number[];
      const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
      const res = await fetch(
        `${apiUrl}/metrics/sparkline?area=${area}&key=${encodeURIComponent(key)}&minutes=${minutes}`,
      );
      if (!res.ok) return [] as number[];
      const json = (await res.json()) as { values?: number[] };
      return json.values ?? [];
    },
  });
}
