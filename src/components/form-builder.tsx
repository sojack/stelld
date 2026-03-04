"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { v4 as uuid } from "uuid";
import { FieldPalette, FIELD_TYPES, type FieldTypeId } from "./builder/field-palette";
import { CanvasField } from "./builder/canvas-field";
import { PropertyEditor } from "./builder/property-editor";
import type { FormField } from "./builder/types";

interface FormBuilderProps {
  formId: string;
  initialSchema: object;
  initialTitle: string;
  isPublished: boolean;
}

function parseSchema(schema: object): FormField[] {
  const s = schema as { pages?: { elements?: Omit<FormField, "_id">[] }[] };
  const elements = s?.pages?.[0]?.elements ?? [];
  return elements.map((el) => ({ ...el, _id: uuid() }));
}

function toSurveyJson(fields: FormField[]): object {
  if (fields.length === 0) return {};
  const elements = fields.map(({ _id, ...rest }) => rest);
  return { pages: [{ elements }] };
}

export function FormBuilder({ formId, initialSchema, initialTitle, isPublished }: FormBuilderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [published, setPublished] = useState(isPublished);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [fields, setFields] = useState<FormField[]>(() => parseSchema(initialSchema));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fieldCounter = useRef(fields.length);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const selectedField = fields.find((f) => f._id === selectedId) ?? null;

  // Auto-save on change (debounced 3s)
  const scheduleAutoSave = useCallback((updatedFields: FormField[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveForm(updatedFields);
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const saveForm = useCallback(async (updatedFields?: FormField[]) => {
    setSaving(true);
    const schema = toSurveyJson(updatedFields ?? fields);
    await fetch(`/api/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, schema }),
    });
    setSaving(false);
    setLastSaved(new Date());
  }, [formId, title, fields]);

  function updateFields(newFields: FormField[]) {
    setFields(newFields);
    scheduleAutoSave(newFields);
  }

  function addField(typeId: FieldTypeId) {
    fieldCounter.current++;
    const fieldType = FIELD_TYPES.find((t) => t.id === typeId)!;
    const id = uuid();
    const newField: FormField = {
      _id: id,
      type: fieldType.surveyType,
      name: `question${fieldCounter.current}`,
      title: fieldType.label,
      isRequired: false,
      ...(fieldType.inputType && { inputType: fieldType.inputType }),
      ...(fieldType.hasChoices && { choices: ["Option 1", "Option 2", "Option 3"] }),
    };
    const newFields = [...fields, newField];
    updateFields(newFields);
    setSelectedId(id);
  }

  function updateField(id: string, updates: Partial<FormField>) {
    const newFields = fields.map((f) =>
      f._id === id ? { ...f, ...updates } : f
    );
    updateFields(newFields);
  }

  function deleteField(id: string) {
    const newFields = fields.filter((f) => f._id !== id);
    if (selectedId === id) setSelectedId(null);
    updateFields(newFields);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;

    // Dragging from palette
    if (typeof active.id === "string" && active.id.startsWith("palette-") && over) {
      const typeId = active.id.replace("palette-", "") as FieldTypeId;
      addField(typeId);
      return;
    }

    // Reordering within canvas
    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((f) => f._id === active.id);
      const newIndex = fields.findIndex((f) => f._id === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        updateFields(arrayMove(fields, oldIndex, newIndex));
      }
    }
  }

  async function togglePublish() {
    const newState = !published;
    await fetch(`/api/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: newState }),
    });
    setPublished(newState);
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href="/dashboard" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">&larr; Dashboard</a>
          <div className="w-px h-5 bg-gray-200" />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveForm()}
            className="font-semibold text-lg text-gray-900 border-none outline-none focus:ring-1 focus:ring-gray-300 rounded px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">
            {saving ? "Saving..." : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ""}
          </span>
          {published && (
            <a
              href={`/f/${formId}`}
              target="_blank"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
            >
              View live form
            </a>
          )}
          <button
            onClick={togglePublish}
            className={`text-sm font-medium px-5 py-2 rounded-md transition-colors ${
              published
                ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {/* Builder 3-panel layout */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Field Palette */}
          <div className="w-[200px] bg-white border-r p-3 overflow-y-auto">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Fields</h3>
            <FieldPalette onAddField={addField} />
          </div>

          {/* Center: Canvas */}
          <div
            className="flex-1 bg-gray-50 p-6 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedId(null);
            }}
          >
            <div className="max-w-2xl mx-auto">
              {fields.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-400">
                  <p className="text-lg mb-1">Drag fields here</p>
                  <p className="text-sm">or click a field type on the left to add it</p>
                </div>
              ) : (
                <SortableContext
                  items={fields.map((f) => f._id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <CanvasField
                        key={field._id}
                        field={field}
                        isSelected={selectedId === field._id}
                        onSelect={() => setSelectedId(field._id)}
                        onDelete={() => deleteField(field._id)}
                      />
                    ))}
                  </div>
                </SortableContext>
              )}
            </div>
          </div>

          {/* Right: Property Editor */}
          <div className="w-[280px] bg-white border-l p-4 overflow-y-auto">
            {selectedField ? (
              <PropertyEditor
                field={selectedField}
                onChange={(updates) => updateField(selectedField._id, updates)}
              />
            ) : (
              <div className="text-sm text-gray-500 text-center pt-8">
                Select a field to edit its properties
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="bg-white border border-blue-300 rounded px-3 py-2 shadow-lg text-sm">
              {activeId.startsWith("palette-")
                ? FIELD_TYPES.find((t) => t.id === activeId.replace("palette-", ""))?.label
                : fields.find((f) => f._id === activeId)?.title}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
