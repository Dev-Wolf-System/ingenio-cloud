'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ReactNode } from 'react';

interface SortableTileProps {
  id: string;
  children: ReactNode;
}

/**
 * Wrapper draggable para tiles dentro de un SortableContext.
 * El cursor cambia a grab/grabbing y el tile se ilumina al arrastrar.
 */
export function SortableTile({ id, children }: SortableTileProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 50 : undefined,
    boxShadow: isDragging
      ? '0 12px 32px rgba(0,0,0,0.45), 0 0 0 2px var(--primary-light)'
      : undefined,
  } as React.CSSProperties;

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      {children}
    </div>
  );
}
