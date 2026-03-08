"use client";

import { useDraggable } from "@dnd-kit/core";
import { useTranslations } from "next-intl";

export type FieldTypeId =
  | "text"
  | "email"
  | "phone"
  | "number"
  | "textarea"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "date"
  | "payment";

export interface FieldType {
  id: FieldTypeId;
  labelKey: string;
  icon: string;
  surveyType: string;
  inputType?: string;
  hasChoices?: boolean;
  isPayment?: boolean;
  label: string; // resolved at render time
}

const FIELD_TYPE_DEFS: Omit<FieldType, "label">[] = [
  { id: "text", labelKey: "fieldText", icon: "Aa", surveyType: "text" },
  { id: "email", labelKey: "fieldEmail", icon: "@", surveyType: "text", inputType: "email" },
  { id: "phone", labelKey: "fieldPhone", icon: "#", surveyType: "text", inputType: "tel" },
  { id: "number", labelKey: "fieldNumber", icon: "123", surveyType: "text", inputType: "number" },
  { id: "textarea", labelKey: "fieldTextarea", icon: "¶", surveyType: "comment" },
  { id: "dropdown", labelKey: "fieldDropdown", icon: "▾", surveyType: "dropdown", hasChoices: true },
  { id: "checkbox", labelKey: "fieldCheckbox", icon: "☑", surveyType: "checkbox", hasChoices: true },
  { id: "radio", labelKey: "fieldRadio", icon: "◉", surveyType: "radiogroup", hasChoices: true },
  { id: "date", labelKey: "fieldDate", icon: "📅", surveyType: "text", inputType: "date" },
  { id: "payment", labelKey: "fieldPayment", icon: "$", surveyType: "expression", isPayment: true },
];

// Exported for use in form-builder (addField needs label + surveyType etc.)
export let FIELD_TYPES: FieldType[] = FIELD_TYPE_DEFS.map((d) => ({
  ...d,
  label: d.labelKey, // fallback; resolved properly in FieldPalette
}));

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
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left rounded-md border border-transparent hover:bg-gray-100 hover:border-gray-200 transition-colors ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <span className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-600 font-mono text-xs shrink-0">{type.icon}</span>
      <span className="text-gray-800 font-medium">{type.label}</span>
    </button>
  );
}

interface FieldPaletteProps {
  onAddField: (typeId: FieldTypeId) => void;
  plan?: string;
}

export function FieldPalette({ onAddField, plan }: FieldPaletteProps) {
  const t = useTranslations("builder");

  // Resolve translated labels
  const translatedTypes = FIELD_TYPE_DEFS.map((d) => ({
    ...d,
    label: t(d.labelKey),
  }));

  // Update the exported FIELD_TYPES so form-builder's addField uses translated labels
  FIELD_TYPES = translatedTypes;

  return (
    <div className="space-y-0.5">
      {translatedTypes.map((type) => {
        if (type.isPayment && plan !== "BUSINESS") {
          return (
            <div
              key={type.id}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-md opacity-50 cursor-not-allowed"
            >
              <span className="w-7 h-7 flex items-center justify-center rounded bg-gray-100 text-gray-400 font-mono text-xs shrink-0">{type.icon}</span>
              <span className="text-gray-400 font-medium">{type.label}</span>
              <span className="ml-auto text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{t("businessOnly")}</span>
            </div>
          );
        }
        return (
          <PaletteItem key={type.id} type={type} onAdd={() => onAddField(type.id)} />
        );
      })}
    </div>
  );
}
