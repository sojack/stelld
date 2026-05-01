"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import type { FormField, LocalizedString } from "./types";

function getDefault(value: LocalizedString | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.default ?? "";
}

interface CanvasFieldProps {
  field: FormField;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function FieldPreview({ field }: { field: FormField }) {
  const t = useTranslations("builder");
  const baseClass = "w-full border rounded px-3 py-2 bg-gray-50 text-sm text-gray-500 pointer-events-none";

  if (field.type === "comment") {
    return <textarea className={`${baseClass} h-20 resize-none`} placeholder={getDefault(field.placeholder) || t("longTextPlaceholder")} readOnly />;
  }

  if (field.type === "dropdown") {
    return (
      <select className={baseClass} disabled>
        <option>{t("selectOption")}</option>
      </select>
    );
  }

  if (field.type === "checkbox" || field.type === "radiogroup") {
    const inputType = field.type === "checkbox" ? "checkbox" : "radio";
    return (
      <div className="space-y-1">
        {(field.choices ?? []).map((choice, i) => (
          <label key={i} className="flex items-center gap-2 text-sm text-gray-700 pointer-events-none">
            <input type={inputType} disabled className="pointer-events-none" />
            {getDefault(choice as LocalizedString)}
          </label>
        ))}
      </div>
    );
  }

  return (
    <input
      type="text"
      className={baseClass}
      placeholder={getDefault(field.placeholder) || t("enterPlaceholder", { label: getDefault(field.title).toLowerCase() })}
      readOnly
    />
  );
}

export function CanvasField({ field, isSelected, onSelect, onDelete }: CanvasFieldProps) {
  const t = useTranslations("builder");
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const wrapperClass = `bg-white rounded-lg border-2 cursor-pointer transition-colors ${
    isDragging ? "opacity-50" : ""
  } ${isSelected ? "border-blue-500 shadow-sm" : "border-transparent hover:border-gray-300"}`;

  if (field.displayKind === "divider") {
    return (
      <div
        ref={setNodeRef}
        style={style}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        className={`${wrapperClass} px-4 py-3`}
      >
        <div className="flex items-center gap-2">
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab text-gray-400 hover:text-gray-700 text-lg leading-none"
            title={t("dragToReorder")}
          >
            ⠿
          </span>
          <hr className="flex-1 border-gray-300" />
          {isSelected && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-gray-400 hover:text-red-500 text-lg leading-none"
              title={t("deleteField")}
            >
              &times;
            </button>
          )}
        </div>
      </div>
    );
  }

  if (field.displayKind === "subtitle") {
    const text = getDefault(field.subtitleText);
    return (
      <div
        ref={setNodeRef}
        style={style}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        className={`${wrapperClass} p-4`}
      >
        <div className="flex items-start gap-2">
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab text-gray-400 hover:text-gray-700 mt-1 text-lg leading-none"
            title={t("dragToReorder")}
          >
            ⠿
          </span>
          <h2 className="flex-1 text-xl font-semibold text-gray-900">
            {text || <span className="text-gray-400 italic font-normal">{t("subtitleText")}</span>}
          </h2>
          {isSelected && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-gray-400 hover:text-red-500 text-lg leading-none"
              title={t("deleteField")}
            >
              &times;
            </button>
          )}
        </div>
      </div>
    );
  }

  if (field.displayKind === "description") {
    const text = getDefault(field.descriptionText);
    return (
      <div
        ref={setNodeRef}
        style={style}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        className={`${wrapperClass} p-4`}
      >
        <div className="flex items-start gap-2">
          <span
            {...attributes}
            {...listeners}
            className="cursor-grab text-gray-400 hover:text-gray-700 mt-1 text-lg leading-none"
            title={t("dragToReorder")}
          >
            ⠿
          </span>
          <p className="flex-1 text-sm text-gray-600 whitespace-pre-line">
            {text || <span className="text-gray-400 italic">{t("descriptionText")}</span>}
          </p>
          {isSelected && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-gray-400 hover:text-red-500 text-lg leading-none"
              title={t("deleteField")}
            >
              &times;
            </button>
          )}
        </div>
      </div>
    );
  }

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
            <span
              {...attributes}
              {...listeners}
              className="cursor-grab text-gray-400 hover:text-gray-700 mr-1.5 text-lg leading-none"
              title={t("dragToReorder")}
            >
              ⠿
            </span>
            <span className="text-sm font-medium text-gray-900">{getDefault(field.title)}</span>
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
            title={t("deleteField")}
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
