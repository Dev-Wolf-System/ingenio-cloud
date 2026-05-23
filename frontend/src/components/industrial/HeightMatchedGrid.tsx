'use client';

import { useRef, useLayoutEffect, useState, type ReactNode } from 'react';

export function HeightMatchedGrid({
  left,
  right,
  className = '',
  colsClass = 'grid-cols-1 lg:grid-cols-2',
}: {
  left: ReactNode;
  right: ReactNode;
  className?: string;
  colsClass?: string;
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
    <div className={`grid gap-3 ${colsClass} ${className}`}>
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
