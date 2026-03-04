"use client";

import { useEffect, useRef } from "react";
import type { FormField } from "./types";

interface PropertyEditorProps {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
}

export function PropertyEditor({ field, onChange }: PropertyEditorProps) {
  const labelRef = useRef<HTMLInputElement>(null);
  const prevFieldId = useRef(field._id);

  // Auto-select label text when a new field is selected
  useEffect(() => {
    if (field._id !== prevFieldId.current) {
      prevFieldId.current = field._id;
      labelRef.current?.focus();
      labelRef.current?.select();
    }
  }, [field._id]);
  const hasChoices = field.type === "dropdown" || field.type === "checkbox" || field.type === "radiogroup";
  const hasPlaceholder = field.type === "text" || field.type === "comment";
  const isNumber = field.inputType === "number";

  function updateChoice(index: number, value: string) {
    const newChoices = [...(field.choices ?? [])];
    newChoices[index] = value;
    onChange({ choices: newChoices });
  }

  function addChoice() {
    const newChoices = [...(field.choices ?? []), `Option ${(field.choices?.length ?? 0) + 1}`];
    onChange({ choices: newChoices });
  }

  function removeChoice(index: number) {
    const newChoices = (field.choices ?? []).filter((_, i) => i !== index);
    onChange({ choices: newChoices });
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase">Properties</h3>

      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
        <input
          ref={labelRef}
          type="text"
          value={field.title}
          onChange={(e) => onChange({ title: e.target.value })}
          onFocus={(e) => e.target.select()}
          className="w-full border rounded px-3 py-1.5 text-sm"
        />
      </div>

      {/* Field Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Field name</label>
        <input
          type="text"
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value.replace(/\s/g, "_") })}
          onFocus={(e) => e.target.select()}
          className="w-full border rounded px-3 py-1.5 text-sm font-mono"
        />
        <p className="text-xs text-gray-400 mt-0.5">Used in submissions data</p>
      </div>

      {/* Required */}
      <div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={field.isRequired}
            onChange={(e) => onChange({ isRequired: e.target.checked })}
          />
          Required
        </label>
      </div>

      {/* Placeholder */}
      {hasPlaceholder && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Placeholder</label>
          <input
            type="text"
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            className="w-full border rounded px-3 py-1.5 text-sm"
          />
        </div>
      )}

      {/* Min/Max for number */}
      {isNumber && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Min</label>
            <input
              type="number"
              value={field.min ?? ""}
              onChange={(e) => onChange({ min: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Max</label>
            <input
              type="number"
              value={field.max ?? ""}
              onChange={(e) => onChange({ max: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full border rounded px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      )}

      {/* Choices */}
      {hasChoices && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Options</label>
          <div className="space-y-1.5">
            {(field.choices ?? []).map((choice, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="text"
                  value={choice}
                  onChange={(e) => updateChoice(i, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
                <button
                  onClick={() => removeChoice(i)}
                  className="text-gray-400 hover:text-red-500 text-sm px-1"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addChoice}
            className="text-sm text-blue-600 hover:underline mt-1.5"
          >
            + Add option
          </button>
        </div>
      )}
    </div>
  );
}
