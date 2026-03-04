"use client";

import { useDraggable } from "@dnd-kit/core";

export type FieldTypeId =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "textarea"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "date";

export interface FieldType {
  id: FieldTypeId;
  label: string;
  icon: string;
  surveyType: string;
  inputType?: string;
  hasChoices?: boolean;
}

export const FIELD_TYPES: FieldType[] = [
  { id: "text", label: "Text", icon: "Aa", surveyType: "text" },
  { id: "email", label: "Email", icon: "@", surveyType: "text", inputType: "email" },
  { id: "phone", label: "Phone", icon: "#", surveyType: "text", inputType: "tel" },
  { id: "number", label: "Number", icon: "123", surveyType: "text", inputType: "number" },
  { id: "textarea", label: "Textarea", icon: "¶", surveyType: "comment" },
  { id: "dropdown", label: "Dropdown", icon: "▾", surveyType: "dropdown", hasChoices: true },
  { id: "checkbox", label: "Checkbox", icon: "☑", surveyType: "checkbox", hasChoices: true },
  { id: "radio", label: "Radio", icon: "◉", surveyType: "radiogroup", hasChoices: true },
  { id: "date", label: "Date", icon: "📅", surveyType: "text", inputType: "date" },
];

function PaletteItem({ type, onAdd }: { type: FieldType; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type.id}`,
  });

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onAdd}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded hover:bg-gray-100 transition-colors ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <span className="w-6 text-center text-gray-400 font-mono text-xs">{type.icon}</span>
      <span>{type.label}</span>
    </button>
  );
}

interface FieldPaletteProps {
  onAddField: (typeId: FieldTypeId) => void;
}

export function FieldPalette({ onAddField }: FieldPaletteProps) {
  return (
    <div className="space-y-0.5">
      {FIELD_TYPES.map((type) => (
        <PaletteItem key={type.id} type={type} onAdd={() => onAddField(type.id)} />
      ))}
    </div>
  );
}
