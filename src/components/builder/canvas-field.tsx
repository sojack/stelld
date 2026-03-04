"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormField } from "./types";

interface CanvasFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function FieldPreview({ field }: { field: FormField }) {
  const baseClass = "w-full border rounded px-3 py-2 bg-gray-50 text-sm text-gray-400 pointer-events-none";

  if (field.type === "comment") {
    return <textarea className={`${baseClass} h-20 resize-none`} placeholder={field.placeholder || "Long text answer"} readOnly />;
  }

  if (field.type === "dropdown") {
    return (
      <select className={baseClass} disabled>
        <option>Select an option...</option>
      </select>
    );
  }

  if (field.type === "checkbox" || field.type === "radiogroup") {
    const inputType = field.type === "checkbox" ? "checkbox" : "radio";
    return (
      <div className="space-y-1">
        {(field.choices ?? []).map((choice, i) => (
          <label key={i} className="flex items-center gap-2 text-sm text-gray-500 pointer-events-none">
            <input type={inputType} disabled className="pointer-events-none" />
            {choice}
          </label>
        ))}
      </div>
    );
  }

  return (
    <input
      type="text"
      className={baseClass}
      placeholder={field.placeholder || `Enter ${field.title.toLowerCase()}...`}
      readOnly
    />
  );
}

export function CanvasField({ field, isSelected, onSelect, onDelete }: CanvasFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.name });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`bg-white rounded-lg border-2 p-4 cursor-pointer transition-colors ${
        isDragging ? "opacity-50" : ""
      } ${isSelected ? "border-blue-500 shadow-sm" : "border-transparent hover:border-gray-300"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-1 mb-2">
            {/* Drag handle */}
            <span
              {...attributes}
              {...listeners}
              className="cursor-grab text-gray-300 hover:text-gray-500 mr-1"
              title="Drag to reorder"
            >
              ⠿
            </span>
            <span className="text-sm font-medium">{field.title}</span>
            {field.isRequired && <span className="text-red-500 text-sm">*</span>}
          </div>
          <FieldPreview field={field} />
        </div>
        {isSelected && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="text-gray-400 hover:text-red-500 text-lg leading-none"
            title="Delete field"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
