'use client';

import { useRef, useLayoutEffect, useState, useEffect, type ReactNode } from 'react';

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
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
        className="min-h-0 lg:overflow-hidden flex flex-col"
        style={isDesktop && h != null ? { height: h } : undefined}
      >
        {right}
      </div>
    </div>
  );
}
