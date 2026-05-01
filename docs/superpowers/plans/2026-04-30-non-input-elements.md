# Non-Input Form Elements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Divider, Subtitle, and Description as non-input field types in the form builder, and remove the Payment field from the palette while leaving all payment code paths intact.

**Architecture:** Internal `FormField.displayKind` discriminator drives the builder's preview and property-editor branching. Live rendering reuses SurveyJS's native `type: "html"` element type — `toSurveyJson` synthesizes the appropriate `html` content (with `{default, fr}` localization) at serialize time. No renderer changes; no schema migration.

**Tech Stack:** Next.js 15 App Router, TypeScript, @dnd-kit (drag/drop), SurveyJS (live render), next-intl (i18n).

**Spec:** `docs/superpowers/specs/2026-04-30-non-input-elements-design.md`

**Testing convention:** This project has no automated test suite. Each task ends with a manual verification step (visit the builder in a browser, check the rendered output) and a commit. The user's existing `npm run build` should succeed at every commit; type errors block progress.

**Important conventions:**
- All client routing/links use `Link`/`useRouter`/`usePathname`/`redirect` from `@/i18n/routing`, not from `next/link`.
- Translations go in `messages/en.json` and `messages/fr.json` under the existing `builder` namespace.
- Existing `LocalizedString` type (`string | { default: string; fr?: string }`) is used for any user-editable text that needs FR translation.
- `escapeHtml` for user input is implemented inline (the same shape used in `src/lib/email.ts`).

---

## Task 1: Extend FormField type with displayKind, subtitleText, descriptionText

**Files:**
- Modify: `src/components/builder/types.ts`

- [ ] **Step 1: Replace the file contents**

```ts
export type LocalizedString = string | { default: string; fr?: string };

export interface FormField {
  _id: string; // stable internal ID, not serialized to SurveyJS JSON
  type: string;
  name: string;
  title: string | LocalizedString;
  isRequired: boolean;
  placeholder?: string | LocalizedString;
  inputType?: string;
  choices?: (string | LocalizedString)[];
  min?: number;
  max?: number;
  paymentAmount?: number;
  paymentCurrency?: "CAD" | "USD";
  paymentDescription?: string;

  // Non-input display element discriminator. When set, this field renders
  // as a divider, subtitle, or description in the builder, and serializes
  // to a SurveyJS `type: "html"` element with synthesized html content.
  displayKind?: "divider" | "subtitle" | "description";
  subtitleText?: LocalizedString;
  descriptionText?: LocalizedString;
}
```

- [ ] **Step 2: Verify types**

Run: `npx tsc --noEmit`
Expected: no errors. (Adding optional properties shouldn't break existing usages.)

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/types.ts
git commit -m "feat(types): add displayKind, subtitleText, descriptionText to FormField"
```

---

## Task 2: Update field palette — drop payment, add divider/subtitle/description

**Files:**
- Modify: `src/components/builder/field-palette.tsx`

- [ ] **Step 1: Read the existing file**

Run: `cat src/components/builder/field-palette.tsx`

You're going to:
1. Update the `FieldTypeId` union (drop `"payment"`, add the three new IDs).
2. Remove the `payment` entry from `FIELD_TYPE_DEFS`.
3. Add three new entries to `FIELD_TYPE_DEFS`.
4. Leave the `isPayment` filter in `FieldPalette`'s render (the entry is gone but the type lives on for backward compat with existing forms; the filter is now a no-op for new palettes but harmless).

- [ ] **Step 2: Apply the edits**

Replace the `FieldTypeId` union (top of file):

```ts
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
  | "divider"
  | "subtitle"
  | "description";
```

Replace the `FIELD_TYPE_DEFS` array:

```ts
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
  { id: "divider", labelKey: "fieldDivider", icon: "—", surveyType: "html", displayKind: "divider" },
  { id: "subtitle", labelKey: "fieldSubtitle", icon: "H₂", surveyType: "html", displayKind: "subtitle" },
  { id: "description", labelKey: "fieldDescription", icon: "¶", surveyType: "html", displayKind: "description" },
];
```

Add `displayKind` to the `FieldType` interface (right above `FIELD_TYPE_DEFS`):

```ts
export interface FieldType {
  id: FieldTypeId;
  labelKey: string;
  icon: string;
  surveyType: string;
  inputType?: string;
  hasChoices?: boolean;
  isPayment?: boolean;
  displayKind?: "divider" | "subtitle" | "description";
  label: string; // resolved at render time
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/builder/field-palette.tsx
git commit -m "feat(builder): drop payment from palette; add divider, subtitle, description"
```

---

## Task 3: Add i18n strings for new elements

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/fr.json`

- [ ] **Step 1: Add keys to `messages/en.json`**

Find the `"builder"` block. After the line `"businessOnly": "Business plan",`, insert:

```json
    "fieldDivider": "Divider",
    "fieldSubtitle": "Subtitle",
    "fieldDescription": "Description",
    "subtitleText": "Subtitle text",
    "descriptionText": "Description text",
    "frenchSubtitle": "French subtitle",
    "frenchDescription": "French description",
    "noPropsForDivider": "Dividers have no properties — they just add a horizontal line.",
    "subtitleDefault": "New section",
    "descriptionDefault": "Add a description...",
```

- [ ] **Step 2: Add keys to `messages/fr.json`**

Mirror the same insertion point in `fr.json`. After `"businessOnly": "Forfait Affaires",`, insert:

```json
    "fieldDivider": "Séparateur",
    "fieldSubtitle": "Sous-titre",
    "fieldDescription": "Description",
    "subtitleText": "Texte du sous-titre",
    "descriptionText": "Texte de la description",
    "frenchSubtitle": "Sous-titre en français",
    "frenchDescription": "Description en français",
    "noPropsForDivider": "Les séparateurs n'ont pas de propriétés — ils ajoutent simplement une ligne horizontale.",
    "subtitleDefault": "Nouvelle section",
    "descriptionDefault": "Ajouter une description...",
```

- [ ] **Step 3: Verify JSON parses**

```bash
node -e "JSON.parse(require('fs').readFileSync('messages/en.json'))" && \
  node -e "JSON.parse(require('fs').readFileSync('messages/fr.json'))" && \
  echo OK
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add messages/en.json messages/fr.json
git commit -m "i18n(builder): add divider/subtitle/description strings (EN + FR)"
```

---

## Task 4: Update FormBuilder.addField to seed displayKind defaults; replace toSurveyJson with HTML synthesis

**Files:**
- Modify: `src/components/form-builder.tsx`

- [ ] **Step 1: Read current file**

Run: `cat src/components/form-builder.tsx`

You'll modify two functions: `toSurveyJson` (top of file, ~line 48) and `addField` (~line 118).

- [ ] **Step 2: Replace `toSurveyJson` and add HTML synthesis helpers**

Locate this block (around lines 47-52):

```ts
function toSurveyJson(fields: FormField[]): object {
  if (fields.length === 0) return {};
  const elements = fields.map(({ _id, ...rest }) => rest);
  return { pages: [{ elements }] };
}
```

Replace with:

```ts
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getLocalizedDefault(value: string | { default?: string; fr?: string } | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.default ?? "";
}

function getLocalizedFr(value: string | { default?: string; fr?: string } | undefined): string {
  if (!value || typeof value === "string") return "";
  return value.fr ?? "";
}

function buildHtmlContent(field: Omit<FormField, "_id">): string | { default: string; fr: string } | undefined {
  if (field.displayKind === "divider") {
    return `<hr class="my-6 border-gray-200" />`;
  }
  if (field.displayKind === "subtitle") {
    const en = getLocalizedDefault(field.subtitleText);
    const frRaw = getLocalizedFr(field.subtitleText);
    const fr = frRaw || en;
    const wrap = (text: string) =>
      `<h2 class="text-xl font-semibold text-gray-900 mt-6 mb-1">${escapeHtml(text)}</h2>`;
    return en === fr ? wrap(en) : { default: wrap(en), fr: wrap(fr) };
  }
  if (field.displayKind === "description") {
    const en = getLocalizedDefault(field.descriptionText);
    const frRaw = getLocalizedFr(field.descriptionText);
    const fr = frRaw || en;
    const wrap = (text: string) =>
      `<p class="text-gray-600 whitespace-pre-line mb-2">${escapeHtml(text)}</p>`;
    return en === fr ? wrap(en) : { default: wrap(en), fr: wrap(fr) };
  }
  return undefined;
}

function toSurveyJson(fields: FormField[]): object {
  if (fields.length === 0) return {};
  const elements = fields.map(({ _id, ...rest }) => {
    const html = buildHtmlContent(rest);
    if (html !== undefined) {
      return { ...rest, html };
    }
    return rest;
  });
  return { pages: [{ elements }] };
}
```

- [ ] **Step 3: Update `addField`**

Locate this block (around lines 118-135):

```ts
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
```

Replace with:

```ts
function addField(typeId: FieldTypeId) {
  fieldCounter.current++;
  const fieldType = FIELD_TYPES.find((t) => t.id === typeId)!;
  const id = uuid();
  const isDisplay =
    typeId === "divider" || typeId === "subtitle" || typeId === "description";

  const newField: FormField = {
    _id: id,
    type: fieldType.surveyType,
    name: isDisplay ? `${typeId}${fieldCounter.current}` : `question${fieldCounter.current}`,
    title: isDisplay ? "" : fieldType.label,
    isRequired: false,
    ...(fieldType.inputType && { inputType: fieldType.inputType }),
    ...(fieldType.hasChoices && {
      choices: [
        t("defaultOption", { number: 1 }),
        t("defaultOption", { number: 2 }),
        t("defaultOption", { number: 3 }),
      ],
    }),
    ...(fieldType.isPayment && {
      paymentAmount: 0,
      paymentCurrency: "CAD" as const,
      paymentDescription: "",
    }),
    ...(typeId === "divider" && { displayKind: "divider" as const }),
    ...(typeId === "subtitle" && {
      displayKind: "subtitle" as const,
      subtitleText: t("subtitleDefault"),
    }),
    ...(typeId === "description" && {
      displayKind: "description" as const,
      descriptionText: t("descriptionDefault"),
    }),
  };
  const newFields = [...fields, newField];
  updateFields(newFields);
  setSelectedId(id);
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/form-builder.tsx
git commit -m "feat(builder): seed displayKind defaults; synthesize html in toSurveyJson"
```

---

## Task 5: Update CanvasField preview to render divider/subtitle/description

**Files:**
- Modify: `src/components/builder/canvas-field.tsx`

- [ ] **Step 1: Read current file**

Run: `cat src/components/builder/canvas-field.tsx`

You'll add three early returns at the top of the `CanvasField` body, before the existing `<div className="flex items-start...">` rendering. The drag handle, selection ring, and delete button are reused via the same wrapper pattern.

- [ ] **Step 2: Add the helper for description text**

The existing `getDefault` helper (top of file) already handles `LocalizedString`. We'll reuse it.

- [ ] **Step 3: Insert the three early-return branches**

Find this block (around lines 77-87):

```tsx
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
```

**Immediately before** the `return (` line, insert:

```tsx
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
```

The existing `return (...)` for input fields stays unchanged below these three branches.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/builder/canvas-field.tsx
git commit -m "feat(builder): canvas preview for divider, subtitle, description"
```

---

## Task 6: Update PropertyEditor with divider/subtitle/description branches

**Files:**
- Modify: `src/components/builder/property-editor.tsx`

- [ ] **Step 1: Read current file**

Run: `cat src/components/builder/property-editor.tsx`

The existing `PropertyEditor` returns a single `<div className="space-y-4">` containing all property controls. Add three early returns at the top of the function body (after the existing `useEffect` and helper-variable declarations) before that return.

- [ ] **Step 2: Insert the three branches**

Find this block (around lines 98-100):

```tsx
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("properties")}</h3>
```

**Immediately before** the existing `return (` line, insert:

```tsx
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
            ref={labelRef as unknown as React.RefObject<HTMLTextAreaElement>}
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
```

Note on the `labelRef` cast in the description branch: the existing component holds `labelRef` as a `useRef<HTMLInputElement>`. For the description's textarea we cast to `RefObject<HTMLTextAreaElement>` so the auto-select-on-add behavior also fires for descriptions. This works at runtime because React refs are loosely typed at the DOM-element level.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/builder/property-editor.tsx
git commit -m "feat(builder): property editor for divider, subtitle, description"
```

---

## Task 7: Manual verification

This is a checklist run, not a code change. Execute each step in a browser against the running dev server.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Open: http://localhost:3000/en/dashboard
Log in if needed and open any existing form (or create a new one).

- [ ] **Step 2: Verify the palette**

Confirm the left palette shows three new entries near the bottom: **Divider**, **Subtitle**, **Description**.
Confirm the **Payment** entry is no longer in the palette.

- [ ] **Step 3: Add a Divider**

Click the Divider entry. A horizontal line appears in the canvas. Click it. Confirm the property panel shows "Properties" and the message "Dividers have no properties — they just add a horizontal line."

- [ ] **Step 4: Add a Subtitle**

Click the Subtitle entry. The canvas shows a styled subtitle reading "New section". Click it. The property panel shows a Subtitle text input pre-filled with "New section" and a French Subtitle field below the Translations divider. Edit both fields. Confirm the canvas updates as you type.

- [ ] **Step 5: Add a Description**

Click the Description entry. The canvas shows a styled paragraph reading "Add a description...". Click it. The property panel shows a Description text textarea + a French Description textarea. Type multi-line content. Confirm line breaks render in the canvas preview.

- [ ] **Step 6: Drag to reorder**

Drag the Subtitle above an existing input field. Confirm reorder works. Repeat with Divider and Description.

- [ ] **Step 7: Confirm autosave + reload**

Wait for the autosave indicator to settle. Refresh the page. Confirm all three new elements reload correctly with their content intact (round-trip works).

- [ ] **Step 8: View live form**

Publish the form (if not already), click "View live form". Confirm:
- Divider renders as a horizontal line.
- Subtitle renders as a styled heading with the EN text.
- Description renders as a paragraph with line breaks preserved.

Switch language to FR via the language switcher on the live form. Confirm:
- Subtitle and Description render in French.
- (Divider has no text — same on both languages.)

- [ ] **Step 9: Submit the form**

Submit the live form. Open the dashboard for that form's submissions. Confirm the submissions table contains entries only for the input fields — no entries for divider/subtitle/description.

- [ ] **Step 10: Confirm existing payment forms still work**

If there's an existing form with a Payment field, open it in the builder. Confirm:
- The Payment field still appears in the canvas.
- Selecting it shows Payment Amount, Currency, and Payment Description fields in the property editor.
- The form still saves via autosave.
- View it on the live page — payment form still renders.

- [ ] **Step 11: Final build check**

Stop the dev server. Run a production build:

```bash
npm run build
```

Expected: build succeeds with no errors. All routes compile.

- [ ] **Step 12: Commit verification log**

No code change. Skip commit.

---

## Self-Review Notes

**Spec coverage:**
- New `displayKind`, `subtitleText`, `descriptionText` types → Task 1.
- Palette changes (drop payment, add three) → Task 2.
- i18n strings → Task 3.
- `addField` defaults + `toSurveyJson` HTML synthesis → Task 4.
- Canvas preview branches → Task 5.
- Property editor branches → Task 6.
- Renderer is unchanged (no task needed) — covered by the spec's "No code changes" note.
- Manual verification of all spec scenarios → Task 7.
- Existing payment forms continue to work → Task 7 step 10.

**No placeholders, no vague instructions:** every step contains the exact code or commands needed. The only "imprecise" element is the manual verification, which is by definition a human-in-the-loop checklist.

**Type consistency:** `displayKind` literals (`"divider"` / `"subtitle"` / `"description"`) match across types, palette, addField, canvas, property editor, and toSurveyJson. `subtitleText` and `descriptionText` are referenced consistently. `LocalizedString` round-trips through the existing helpers.
