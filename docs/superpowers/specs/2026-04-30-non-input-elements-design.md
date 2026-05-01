# Non-Input Form Elements — Design

**Date:** 2026-04-30
**Status:** Approved (pending user review of this document)

## Summary

Add three non-input display elements to the form builder — **Divider** (horizontal line), **Subtitle** (section heading), and **Description** (paragraph text) — and remove the **Payment** field from the palette while leaving all payment-related code, renderer paths, and existing forms intact.

## Goals

- Form authors can break a form into visual sections via a divider line.
- Form authors can label sections with a subtitle and an optional description.
- All three elements are bilingual (EN/FR) where they carry text.
- Live forms render the new elements through SurveyJS without custom render code.
- Payment field disappears from the palette but existing forms that already use it continue to function unchanged.

## Non-Goals

- Custom SurveyJS components / `Serializer.addClass` plumbing.
- Per-section conditional visibility, collapsible sections, or wizard-style multi-page forms.
- Removal of payment-related code, plan limits, Stripe Connect flow, or webhook handlers.

## Architecture

The schema stays SurveyJS-compatible. New elements use SurveyJS's native `type: "html"` so the renderer requires no changes. Builder-side metadata (`displayKind`, `subtitleText`, `descriptionText`) lives alongside the SurveyJS fields in JSONB and round-trips through `parseSchema` / `toSurveyJson` unchanged.

At serialize time, `toSurveyJson` synthesizes the appropriate `html` content from `displayKind` plus the user's text. At parse time, the metadata fields survive because we already spread `...el` in `parseSchema`. The builder branches on `displayKind` to drive preview rendering and property-editor UI; the renderer branches on nothing — it just hands SurveyJS native HTML.

## Data Model

Extend `FormField` in `src/components/builder/types.ts`:

```ts
export interface FormField {
  _id: string;
  type: string;                          // "text" | "html" | "dropdown" | etc.
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

  // NEW — non-input display element discriminator
  displayKind?: "divider" | "subtitle" | "description";
  subtitleText?: LocalizedString;
  descriptionText?: LocalizedString;
}
```

For all three new elements:
- `type` is `"html"` (so SurveyJS renders it natively).
- `name` is auto-generated for SurveyJS internals (`divider1`, `section1`, `description1`); never user-edited, never used as a submission key.
- `isRequired` is always `false`.
- `title` is unused by the renderer for these elements (we use `subtitleText` / `descriptionText` instead) but kept as a no-op default to preserve the existing FormField shape.

## Field Palette

Add three entries to `FIELD_TYPE_DEFS` in `src/components/builder/field-palette.tsx`:

```ts
{ id: "divider",     labelKey: "fieldDivider",     icon: "—",  surveyType: "html" },
{ id: "subtitle",    labelKey: "fieldSubtitle",    icon: "H₂", surveyType: "html" },
{ id: "description", labelKey: "fieldDescription", icon: "¶",  surveyType: "html" },
```

Remove the `payment` entry from `FIELD_TYPE_DEFS`. Keep all other payment code untouched.

Update `FieldTypeId` union accordingly:
```ts
export type FieldTypeId =
  | "text" | "email" | "phone" | "number" | "textarea"
  | "dropdown" | "checkbox" | "radio" | "date"
  | "divider" | "subtitle" | "description";
```

`FieldType` interface gains an optional `displayKind`:
```ts
export interface FieldType {
  id: FieldTypeId;
  labelKey: string;
  icon: string;
  surveyType: string;
  inputType?: string;
  hasChoices?: boolean;
  isPayment?: boolean;     // legacy — no current users in palette but kept for type stability
  displayKind?: "divider" | "subtitle" | "description";  // NEW
  label: string;
}
```

## Add Field

Update `addField` in `src/components/form-builder.tsx`. The current implementation builds a `FormField` from the palette type. Extend it to set `displayKind` and the right defaults for the new types:

```ts
function addField(typeId: FieldTypeId) {
  fieldCounter.current++;
  const fieldType = FIELD_TYPES.find((t) => t.id === typeId)!;
  const id = uuid();

  const isDisplay = typeId === "divider" || typeId === "subtitle" || typeId === "description";
  const newField: FormField = {
    _id: id,
    type: fieldType.surveyType,
    name: isDisplay
      ? `${typeId}${fieldCounter.current}`
      : `question${fieldCounter.current}`,
    title: isDisplay ? "" : fieldType.label,
    isRequired: false,
    ...(fieldType.inputType && { inputType: fieldType.inputType }),
    ...(fieldType.hasChoices && { choices: [/* existing default options */] }),
    ...(typeId === "subtitle" && { displayKind: "subtitle", subtitleText: t("subtitleDefault") }),
    ...(typeId === "description" && { displayKind: "description", descriptionText: t("descriptionDefault") }),
    ...(typeId === "divider" && { displayKind: "divider" }),
  };
  // ...rest unchanged...
}
```

## Canvas Preview

In `src/components/builder/canvas-field.tsx`, branch on `displayKind` *before* the existing label/required/preview rendering. The divider/subtitle/description branches still keep the drag handle, selection ring, and delete button — but skip the question label header and the input preview.

```tsx
// inside the existing CanvasField component, before the current `<div className="flex items-start...">`:
if (field.displayKind === "divider") {
  return (
    <div ref={setNodeRef} style={style} onClick={onSelect}
         className={`bg-white rounded-lg border-2 px-4 py-3 cursor-pointer transition-colors
                     ${isDragging ? "opacity-50" : ""}
                     ${isSelected ? "border-blue-500 shadow-sm" : "border-transparent hover:border-gray-300"}`}>
      <div className="flex items-center gap-2">
        <span {...attributes} {...listeners} className="cursor-grab text-gray-400 ...">⠿</span>
        <hr className="flex-1 border-gray-300" />
        {isSelected && <DeleteButton onClick={onDelete} />}
      </div>
    </div>
  );
}

if (field.displayKind === "subtitle") {
  const text = getDefault(field.subtitleText) || "(empty subtitle)";
  return /* similar wrapper, rendered as <h2 className="text-xl font-semibold text-gray-900"> */;
}

if (field.displayKind === "description") {
  const text = getDefault(field.descriptionText) || "(empty description)";
  return /* similar wrapper, rendered as <p className="text-gray-600 whitespace-pre-line"> */;
}

// existing input-field rendering continues below
```

`getDefault` is the existing helper in `canvas-field.tsx:8-12`. The `<DeleteButton>` reuse here is just to keep the spec readable — implementation can inline the existing button.

## Property Editor

In `src/components/builder/property-editor.tsx`, add a top-level branch on `field.displayKind` *before* the existing logic:

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
  // Subtitle text + French translation; no Required, no Placeholder, no Field name, no Choices
  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("properties")}</h3>
      <Field label={t("subtitleText")}
             value={getDefaultString(field.subtitleText)}
             onChange={(v) => onChange({ subtitleText: setFrenchString(field.subtitleText, getFrenchString(field.subtitleText)).default ? { default: v, fr: getFrenchString(field.subtitleText) } : v })} />
      <hr className="my-2 border-gray-200" />
      <h3 className="text-xs font-semibold text-gray-500 uppercase">{t("translations")}</h3>
      <Field label={t("frenchSubtitle")}
             value={getFrenchString(field.subtitleText)}
             onChange={(v) => onChange({ subtitleText: setFrenchString(field.subtitleText, v) })} />
    </div>
  );
}

if (field.displayKind === "description") {
  // Same shape as subtitle but with a textarea and "frenchDescription" key.
}
```

Implementation note: the existing `setFrenchString` and `getDefaultString`/`getFrenchString` helpers in `property-editor.tsx:13-31` already do the LocalizedString conversion. We reuse them for `subtitleText` and `descriptionText` exactly the way `title` is handled today.

## Serialization

In `src/components/form-builder.tsx`, replace `toSurveyJson`:

```ts
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlContent(field: Omit<FormField, "_id">): string | { default: string; fr: string } | undefined {
  if (field.displayKind === "divider") {
    return `<hr class="my-6 border-gray-200" />`;
  }
  if (field.displayKind === "subtitle") {
    const en = getDefault(field.subtitleText);
    const fr = getFr(field.subtitleText) || en;
    const wrap = (t: string) => `<h2 class="text-xl font-semibold text-gray-900 mt-6 mb-1">${escapeHtml(t)}</h2>`;
    return en === fr ? wrap(en) : { default: wrap(en), fr: wrap(fr) };
  }
  if (field.displayKind === "description") {
    const en = getDefault(field.descriptionText);
    const fr = getFr(field.descriptionText) || en;
    const wrap = (t: string) => `<p class="text-gray-600 whitespace-pre-line mb-2">${escapeHtml(t)}</p>`;
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

`getDefault` and `getFr` are small inline helpers (the existing canvas-field.tsx has `getDefault`; we add `getFr` symmetrically or reuse `getFrenchString` from property-editor by hoisting both into a shared helper file — see "File Impact" below).

## Parse

`parseSchema` in `form-builder.tsx:42-46` already does:
```ts
const elements = s?.pages?.[0]?.elements ?? [];
return elements.map((el) => ({ ...el, _id: uuid() }));
```

It spreads all properties, so `displayKind`, `subtitleText`, and `descriptionText` round-trip without change. No edit needed.

## Renderer

No code changes. SurveyJS renders `type: "html"` natively using the `html` property and honors localized `{ default, fr }` html objects through its existing i18n.

## Removing Payment from Palette

Single edit in `src/components/builder/field-palette.tsx`: delete the line:
```ts
{ id: "payment", labelKey: "fieldPayment", icon: "$", surveyType: "expression", isPayment: true },
```

Update the `FieldTypeId` union to drop `"payment"`.

**Preserved:**
- `FormField.paymentAmount`, `paymentCurrency`, `paymentDescription` properties.
- `PropertyEditor`'s payment branch (`property-editor.tsx:49`, conditional on `isPayment`).
- `form-renderer.tsx:72` payment detection.
- `/api/billing/payment-session` and webhook routes.
- `canCollectPayments` plan limit and Stripe Connect flow.

Existing forms with payment fields continue to render, validate, collect payments, and round-trip through autosave correctly.

## i18n

Add to `messages/en.json` under the `builder` namespace:
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
"descriptionDefault": "Add a description..."
```

Mirror in `messages/fr.json`:
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
"descriptionDefault": "Ajouter une description..."
```

## Edge Cases

- **Schema round-trip**: `parseSchema` preserves arbitrary properties via spread, so `displayKind`/`subtitleText`/`descriptionText` survive without explicit handling.
- **HTML injection**: user-supplied subtitle/description text is escaped via the inline `escapeHtml` helper before being wrapped in tags.
- **Submissions payload**: SurveyJS skips data collection for `type: "html"` elements. CSV export and submissions table are unaffected — these elements have no submission keys.
- **Existing forms with payment fields**: untouched. The field still appears in the canvas, in the renderer, and in submissions.
- **Old schemas without `displayKind`**: existing `text`/`comment`/`dropdown`/etc. fields render exactly as before. The new branches in canvas/property editor only fire when `displayKind` is set.
- **Drag-to-reorder**: works for new elements because they use the same `useSortable` hook in `CanvasField`.
- **Required/Validation/`name` collisions**: the auto-generated `name` (`divider1`, `section1`, `description1`) is unique per session and never user-edited; SurveyJS internal-only.
- **Long descriptions**: rendered via `<p ... whitespace-pre-line>` to preserve line breaks; no length cap (form authors can write what they need).

## Testing

This project has no automated test suite. Manual verification:

1. Add a Divider to a form. Save. Confirm a horizontal line appears in canvas preview and on the live form.
2. Add a Subtitle, set EN text + FR text. View live form in `/en/f/...` and `/fr/f/...` — confirm correct language renders.
3. Add a Description, multi-line content. Confirm line breaks preserved on the live form.
4. Add all three elements between input fields. Submit the form. Verify the submissions payload contains only the input fields (no entries for divider/subtitle/description).
5. Open an existing form that has a payment field. Confirm it still renders, the property panel still shows payment editing, autosave still works, and the payment field is *not* in the palette for adding new ones.
6. Delete a payment field from a form's canvas. Save. Reload. Confirm it stays deleted (no re-add path from palette).
7. Round-trip: add Divider + Subtitle + Description; save; refresh page; confirm all three reload correctly with their content intact.

## File Impact

**New helpers:** none — small inline `escapeHtml` / `getFr` co-located with `toSurveyJson`. Optional future cleanup: extract `getDefault`, `getFr`, `setFrenchString` into `src/components/builder/localized.ts` to remove duplication between `canvas-field.tsx`, `property-editor.tsx`, and `form-builder.tsx`. Out of scope for this change unless the duplication becomes painful during implementation.

**Modified:**
- `src/components/builder/types.ts` — add `displayKind`, `subtitleText`, `descriptionText`.
- `src/components/builder/field-palette.tsx` — drop `payment`, add three new entries, extend `FieldTypeId` union.
- `src/components/builder/canvas-field.tsx` — branch on `displayKind` before existing rendering.
- `src/components/builder/property-editor.tsx` — branch on `displayKind` before existing logic.
- `src/components/form-builder.tsx` — extend `addField` defaults; replace `toSurveyJson` with HTML synthesis.
- `messages/en.json`, `messages/fr.json` — new keys under `builder` namespace.
