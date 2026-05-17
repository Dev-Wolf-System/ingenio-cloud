'use client';

import { useEffect } from 'react';
import { animate, useMotionValue, useTransform, m } from 'motion/react';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  decimals = 0,
  duration = 0.9,
  className,
}: AnimatedNumberProps) {
  const mv = useMotionValue(0);
  const display = useTransform(mv, (v) =>
    v.toLocaleString('es-AR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }),
  );

  useEffect(() => {
    if (!Number.isFinite(value)) return;
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] });
    return controls.stop;
  }, [value, mv, duration]);

  return <m.span className={className}>{display}</m.span>;
}
