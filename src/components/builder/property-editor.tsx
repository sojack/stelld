"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { FormField } from "./types";

interface PropertyEditorProps {
  field: FormField;
  onChange: (updates: Partial<FormField>) => void;
}

// Helper functions for localized string support
function getDefaultString(value: string | { default?: string; fr?: string } | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.default ?? "";
}

function getFrenchString(value: string | { default?: string; fr?: string } | undefined): string {
  if (!value || typeof value === "string") return "";
  return value.fr ?? "";
}

function setFrenchString(
  current: string | { default?: string; fr?: string } | undefined,
  frValue: string
): string | { default: string; fr?: string } {
  const defaultVal = getDefaultString(current);
  if (!frValue) return defaultVal; // no French = plain string
  return { default: defaultVal, fr: frValue };
}

export function PropertyEditor({ field, onChange }: PropertyEditorProps) {
  const t = useTranslations("builder");
  const labelRef = useRef<HTMLInputElement>(null);
  const prevFieldId = useRef(field._id);

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
  const isPayment = field.type === "expression" && field.paymentAmount !== undefined;

  const titleDefault = getDefaultString(field.title);
  const titleFr = getFrenchString(field.title);
  const placeholderFr = getFrenchString(field.placeholder);

  function updateChoice(index: number, value: string) {
    const newChoices = [...(field.choices ?? [])];
    const current = newChoices[index];
    if (typeof current === "object") {
      newChoices[index] = { ...current, default: value };
    } else {
      newChoices[index] = value;
    }
    onChange({ choices: newChoices });
  }

  function updateChoiceFr(index: number, frValue: string) {
    const newChoices = [...(field.choices ?? [])];
    const current = newChoices[index];
    const defaultVal = typeof current === "string" ? current : (current as { default?: string }).default ?? "";
    if (!frValue) {
      newChoices[index] = defaultVal;
    } else {
      newChoices[index] = { default: defaultVal, fr: frValue } as unknown as string;
    }
    onChange({ choices: newChoices });
  }

  function addChoice() {
    const newChoices = [...(field.choices ?? []), t("defaultOption", { number: (field.choices?.length ?? 0) + 1 })];
    onChange({ choices: newChoices });
  }

  function removeChoice(index: number) {
    const newChoices = (field.choices ?? []).filter((_, i) => i !== index);
    onChange({ choices: newChoices });
  }

  function getChoiceDefault(choice: string | { default?: string; fr?: string }): string {
    if (typeof choice === "string") return choice;
    return choice.default ?? "";
  }

  function getChoiceFr(choice: string | { default?: string; fr?: string }): string {
    if (typeof choice === "string") return "";
    return choice.fr ?? "";
  }

  if (field.displayKind === "divider") {
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("properties")}</h3>
        <p className="text-sm text-gray-500">{t("noPropsForDivider")}</p>
      </div>
    );
  }

  if (field.displayKind === "subtitle") {
    const enText = getDefaultString(field.subtitleText);
    const frText = getFrenchString(field.subtitleText);
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("properties")}</h3>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">{t("subtitleText")}</label>
          <input
            ref={labelRef}
            type="text"
            value={enText}
            onChange={(e) => {
              const newVal = frText
                ? ({ default: e.target.value, fr: frText } as unknown as string)
                : e.target.value;
              onChange({ subtitleText: newVal });
            }}
            onFocus={(e) => e.target.select()}
            className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
          />
        </div>
        <div className="border-t pt-4 mt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t("translations")}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">{t("frenchSubtitle")}</label>
            <input
              type="text"
              value={frText}
              onChange={(e) =>
                onChange({ subtitleText: setFrenchString(field.subtitleText, e.target.value) as unknown as string })
              }
              placeholder={enText}
              className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
            />
          </div>
        </div>
      </div>
    );
  }

  if (field.displayKind === "description") {
    const enText = getDefaultString(field.descriptionText);
    const frText = getFrenchString(field.descriptionText);
    return (
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("properties")}</h3>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">{t("descriptionText")}</label>
          <textarea
            rows={3}
            value={enText}
            onChange={(e) => {
              const newVal = frText
                ? ({ default: e.target.value, fr: frText } as unknown as string)
                : e.target.value;
              onChange({ descriptionText: newVal });
            }}
            onFocus={(e) => (e.target as HTMLTextAreaElement).select()}
            className="w-full border rounded px-3 py-1.5 text-sm text-gray-900 resize-none"
          />
        </div>
        <div className="border-t pt-4 mt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t("translations")}</h3>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">{t("frenchDescription")}</label>
            <textarea
              rows={3}
              value={frText}
              onChange={(e) =>
                onChange({ descriptionText: setFrenchString(field.descriptionText, e.target.value) as unknown as string })
              }
              placeholder={enText}
              className="w-full border rounded px-3 py-1.5 text-sm text-gray-900 resize-none"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("properties")}</h3>

      {/* Label */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">{t("label")}</label>
        <input
          ref={labelRef}
          type="text"
          value={titleDefault}
          onChange={(e) => {
            const frVal = getFrenchString(field.title);
            if (frVal) {
              onChange({ title: { default: e.target.value, fr: frVal } as unknown as string });
            } else {
              onChange({ title: e.target.value });
            }
          }}
          onFocus={(e) => e.target.select()}
          className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
        />
      </div>

      {/* Field Name */}
      <div>
        <label className="block text-sm font-medium text-gray-900 mb-1">{t("fieldName")}</label>
        <input
          type="text"
          value={field.name}
          onChange={(e) => onChange({ name: e.target.value.replace(/\s/g, "_") })}
          onFocus={(e) => e.target.select()}
          className="w-full border rounded px-3 py-1.5 text-sm font-mono text-gray-900"
        />
        <p className="text-xs text-gray-500 mt-0.5">{t("fieldNameHint")}</p>
      </div>

      {/* Required */}
      <div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-900 cursor-pointer">
          <input
            type="checkbox"
            checked={field.isRequired}
            onChange={(e) => onChange({ isRequired: e.target.checked })}
            className="w-4 h-4"
          />
          {t("required")}
        </label>
      </div>

      {/* Placeholder */}
      {hasPlaceholder && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">{t("placeholder")}</label>
          <input
            type="text"
            value={getDefaultString(field.placeholder)}
            onChange={(e) => {
              const frVal = getFrenchString(field.placeholder);
              if (frVal) {
                onChange({ placeholder: { default: e.target.value, fr: frVal } as unknown as string });
              } else {
                onChange({ placeholder: e.target.value });
              }
            }}
            className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
          />
        </div>
      )}

      {/* Min/Max for number */}
      {isNumber && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-900 mb-1">{t("min")}</label>
            <input
              type="number"
              value={field.min ?? ""}
              onChange={(e) => onChange({ min: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-900 mb-1">{t("max")}</label>
            <input
              type="number"
              value={field.max ?? ""}
              onChange={(e) => onChange({ max: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
            />
          </div>
        </div>
      )}

      {/* Choices */}
      {hasChoices && (
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">{t("options")}</label>
          <div className="space-y-1.5">
            {(field.choices ?? []).map((choice, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  type="text"
                  value={getChoiceDefault(choice as string | { default?: string; fr?: string })}
                  onChange={(e) => updateChoice(i, e.target.value)}
                  onFocus={(e) => e.target.select()}
                  className="flex-1 border rounded px-2 py-1 text-sm text-gray-900"
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
            {t("addOption")}
          </button>
        </div>
      )}

      {/* Payment properties */}
      {isPayment && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">{t("paymentAmount")}</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={field.paymentAmount ?? ""}
              onChange={(e) => onChange({ paymentAmount: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">{t("paymentCurrency")}</label>
            <select
              value={field.paymentCurrency ?? "CAD"}
              onChange={(e) => onChange({ paymentCurrency: e.target.value as "CAD" | "USD" })}
              className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
            >
              <option value="CAD">CAD</option>
              <option value="USD">USD</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">{t("paymentDescription")}</label>
            <input
              type="text"
              value={field.paymentDescription ?? ""}
              onChange={(e) => onChange({ paymentDescription: e.target.value })}
              className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
            />
          </div>
        </>
      )}

      {/* Translations section */}
      <div className="border-t pt-4 mt-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase mb-3">{t("translations")}</h3>

        {/* French label */}
        <div className="mb-3">
          <label className="block text-sm font-medium text-gray-900 mb-1">{t("frenchLabel")}</label>
          <input
            type="text"
            value={titleFr}
            onChange={(e) => {
              onChange({ title: setFrenchString(field.title, e.target.value) as unknown as string });
            }}
            placeholder={titleDefault}
            className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
          />
        </div>

        {/* French placeholder */}
        {hasPlaceholder && (
          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-900 mb-1">{t("frenchPlaceholder")}</label>
            <input
              type="text"
              value={placeholderFr}
              onChange={(e) => {
                onChange({ placeholder: setFrenchString(field.placeholder, e.target.value) as unknown as string });
              }}
              placeholder={getDefaultString(field.placeholder)}
              className="w-full border rounded px-3 py-1.5 text-sm text-gray-900"
            />
          </div>
        )}

        {/* French choices */}
        {hasChoices && (field.choices ?? []).length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">{t("options")} (FR)</label>
            <div className="space-y-1.5">
              {(field.choices ?? []).map((choice, i) => (
                <input
                  key={i}
                  type="text"
                  value={getChoiceFr(choice as string | { default?: string; fr?: string })}
                  onChange={(e) => updateChoiceFr(i, e.target.value)}
                  placeholder={t("frenchOption", { option: getChoiceDefault(choice as string | { default?: string; fr?: string }) })}
                  className="w-full border rounded px-2 py-1 text-sm text-gray-900"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
