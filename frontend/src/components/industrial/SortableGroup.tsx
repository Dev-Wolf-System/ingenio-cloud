'use client';

import { DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';

interface SortableGroupProps {
  items: string[];
  onReorder: (next: string[]) => void;
  children: ReactNode;
}

/**
 * Contexto DnD para reordenar dentro de UN grupo aislado.
 * Cada panel (Energía, Producción, Trapiche, KpiHero) usa su propio
 * SortableGroup — NO se permite mezclar tiles entre grupos distintos
 * porque cada uno tiene su propio DndContext con su propio ID space.
 */
export function SortableGroup({ items, onReorder, children }: SortableGroupProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }, // evita drag accidental en clicks
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.indexOf(String(active.id));
    const newIndex = items.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={rectSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}
