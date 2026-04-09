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
import { useTranslations, useLocale } from "next-intl";
import { FieldPalette, FIELD_TYPES, type FieldTypeId } from "./builder/field-palette";
import { CanvasField } from "./builder/canvas-field";
import { PropertyEditor } from "./builder/property-editor";
import { BannerUploader } from "./builder/banner-uploader";
import { SlugInput } from "./builder/slug-input";
import type { FormField } from "./builder/types";

type FormSettings = { bannerUrl?: string; thankYouMessage?: string };

interface FormBuilderProps {
  formId: string;
  initialSchema: object;
  initialTitle: string;
  initialDescription: string;
  initialSettings: FormSettings;
  initialSlug: string | undefined;
  isPublished: boolean;
  locale: string;
  plan?: string;
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

export function FormBuilder({ formId, initialSchema, initialTitle, initialDescription, initialSettings, initialSlug, isPublished, locale, plan }: FormBuilderProps) {
  const t = useTranslations("builder");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [published, setPublished] = useState(isPublished);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [fields, setFields] = useState<FormField[]>(() => parseSchema(initialSchema));
  const [settings, setSettings] = useState<FormSettings>(initialSettings);
  const [slug, setSlug] = useState<string | undefined>(initialSlug);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState("");
  const [copied, setCopied] = useState(false);
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
    setSaveError(false);
    const schema = toSurveyJson(updatedFields ?? fields);
    try {
      const res = await fetch(`/api/forms/${formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, schema }),
      });
      if (!res.ok) {
        setSaveError(true);
      } else {
        setLastSaved(new Date());
      }
    } catch {
      setSaveError(true);
    }
    setSaving(false);
  }, [formId, title, description, fields]);

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
      ...(fieldType.hasChoices && { choices: [t("defaultOption", { number: 1 }), t("defaultOption", { number: 2 }), t("defaultOption", { number: 3 })] }),
      ...(fieldType.isPayment && { paymentAmount: 0, paymentCurrency: "CAD" as const, paymentDescription: "" }),
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
    if (newState && fields.length === 0) {
      setPublishError(t("emptyFormError"));
      return;
    }
    setPublishError("");
    await fetch(`/api/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPublished: newState }),
    });
    setPublished(newState);
  }

  async function copyLink() {
    const url = `${window.location.origin}/${locale}/f/${formId}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Toolbar */}
      <div className="bg-white border-b px-5 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <a href={`/${locale}/dashboard`} className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">&larr; {t("dashboard")}</a>
          <div className="w-px h-5 bg-gray-200" />
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveForm()}
            maxLength={200}
            className="font-semibold text-lg text-gray-900 border-none outline-none focus:ring-1 focus:ring-gray-300 rounded px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm">
            {saving
              ? <span className="text-gray-500">{t("saving")}</span>
              : saveError
                ? <span className="text-red-600">{t("saveFailed")}</span>
                : lastSaved
                  ? <span className="text-gray-500">{t("saved", { time: lastSaved.toLocaleTimeString() })}</span>
                  : null}
          </span>
          {publishError && (
            <span className="text-sm text-red-600">{publishError}</span>
          )}
          {published && (
            <>
              <a
                href={`/${locale}/f/${formId}`}
                target="_blank"
                className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                {t("viewLiveForm")}
              </a>
              <button
                onClick={copyLink}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                {copied ? t("copied") : t("copyLink")}
              </button>
            </>
          )}
          <button
            onClick={togglePublish}
            className={`text-sm font-medium px-5 py-2 rounded-md transition-colors ${
              published
                ? "bg-gray-200 text-gray-800 hover:bg-gray-300"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {published ? t("unpublish") : t("publish")}
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
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">{t("fields")}</h3>
            <FieldPalette onAddField={addField} plan={plan} />
          </div>

          {/* Center: Canvas */}
          <div
            className="flex-1 bg-gray-50 p-6 overflow-y-auto"
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedId(null);
            }}
          >
            <div className="max-w-2xl mx-auto space-y-4">
              {/* Form title & description header */}
              <div className="bg-white rounded-lg border p-5">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    scheduleAutoSave(fields);
                  }}
                  onBlur={() => saveForm()}
                  maxLength={200}
                  placeholder={t("label")}
                  className="w-full text-2xl font-bold text-gray-900 border-none outline-none placeholder-gray-300 mb-2"
                />
                <textarea
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    scheduleAutoSave(fields);
                  }}
                  onBlur={() => saveForm()}
                  rows={2}
                  placeholder={t("descriptionPlaceholder")}
                  className="w-full text-sm text-gray-600 border-none outline-none placeholder-gray-300 resize-none"
                />
              </div>

              {fields.length === 0 ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center text-gray-400">
                  <p className="text-lg mb-1">{t("dragFieldsHere")}</p>
                  <p className="text-sm">{t("dragFieldsHint")}</p>
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
              <div className="space-y-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("formSettings")}</h3>
                <BannerUploader
                  formId={formId}
                  bannerUrl={settings.bannerUrl}
                  canUpload={plan === "PRO" || plan === "BUSINESS"}
                  onBannerChange={(url) => {
                    const next: FormSettings = { ...settings, bannerUrl: url ?? undefined };
                    setSettings(next);
                    fetch(`/api/forms/${formId}`, {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ settings: next }),
                    });
                  }}
                />
                <SlugInput
                  formId={formId}
                  currentSlug={slug}
                  canCustomize={plan === "PRO" || plan === "BUSINESS"}
                  onSlugChange={(newSlug) => setSlug(newSlug ?? undefined)}
                />
                <p className="text-xs text-gray-400 text-center pt-4">{t("selectFieldHint")}</p>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="bg-white border border-blue-300 rounded px-3 py-2 shadow-lg text-sm">
              {activeId.startsWith("palette-")
                ? FIELD_TYPES.find((t) => t.id === activeId.replace("palette-", ""))?.label
                : (() => {
                    const title = fields.find((f) => f._id === activeId)?.title;
                    return typeof title === "string" ? title : title?.default ?? "";
                  })()}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
