import type { ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SortableLayer({ id, name, className, children }: {
  id: string;
  name: string;
  className: string;
  children: (handle: ReactNode) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li ref={setNodeRef} data-layer-id={id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`${className} relative ${isDragging ? "z-10 ring-2 ring-ring opacity-70" : ""}`}>
      {children(
        <Button ref={setActivatorNodeRef} variant="ghost" size="icon" {...attributes} {...listeners}
          aria-label={`Geser ${name}`} title="Geser urutan peta"
          className="h-6 w-3 shrink-0 touch-none cursor-grab rounded-sm p-0 text-muted-foreground active:cursor-grabbing [&_svg]:size-3">
          <GripVertical />
        </Button>,
      )}
    </li>
  );
}