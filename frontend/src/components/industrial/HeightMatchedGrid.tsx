'use client';

import { useRef, useLayoutEffect, useState, type ReactNode } from 'react';

export function HeightMatchedGrid({
  left,
  right,
  className = '',
}: {
  left: ReactNode;
  right: ReactNode;
  className?: string;
}) {
  const leftRef = useRef<HTMLDivElement>(null);
  const [h, setH] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = leftRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setH(el.getBoundingClientRect().height));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-3 ${className}`}>
      <div ref={leftRef}>{left}</div>
      <div
        className="min-h-0 overflow-hidden flex flex-col"
        style={h != null ? { height: h } : undefined}
      >
        {right}
      </div>
    </div>
  );
}
