# Custom Form Builder Design

**Goal:** Replace SurveyJS Creator ($600 license) with a custom drag-and-drop form builder that outputs SurveyJS-compatible JSON. The free SurveyJS renderer stays unchanged.

## Architecture

- **Drag-and-drop:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Remove:** `survey-creator-core`, `survey-creator-react` packages
- **Keep:** `survey-core`, `survey-react-ui` for public form rendering
- **Single client component:** `src/components/form-builder.tsx` (replaces current SurveyJS Creator wrapper)

## Layout: 3-Panel

```
┌──────────┬─────────────────────────┬──────────────┐
│ PALETTE  │       CANVAS            │  PROPERTIES  │
│ (200px)  │       (flex)            │  (280px)     │
│          │                         │              │
│ Text     │  ┌─────────────────┐    │  Label: ___  │
│ Email    │  │ First Name*     │    │  Required: ☑ │
│ Phone    │  │ [text input]    │    │  Placeholder │
│ Number   │  └─────────────────┘    │              │
│ Textarea │  ┌─────────────────┐    │              │
│ Dropdown │  │ Email           │    │              │
│ Checkbox │  │ [text input]    │    │              │
│ Radio    │  └─────────────────┘    │              │
│ Date     │                         │              │
│          │  + Drop field here      │              │
└──────────┴─────────────────────────┴──────────────┘
```

- **Left:** Field type palette — drag onto canvas to add
- **Center:** Form canvas — drag to reorder, click to select
- **Right:** Property editor — edit selected field properties

## Field Types & Properties

| Type | SurveyJS Mapping | Properties |
|------|-----------------|-----------|
| Text | `type: "text"` | label, name, required, placeholder |
| Email | `type: "text", inputType: "email"` | label, name, required, placeholder |
| Phone | `type: "text", inputType: "tel"` | label, name, required, placeholder |
| Number | `type: "text", inputType: "number"` | label, name, required, placeholder, min, max |
| Textarea | `type: "comment"` | label, name, required, placeholder |
| Dropdown | `type: "dropdown"` | label, name, required, choices[] |
| Checkbox | `type: "checkbox"` | label, name, required, choices[] |
| Radio | `type: "radiogroup"` | label, name, required, choices[] |
| Date | `type: "text", inputType: "date"` | label, name, required |

## JSON Output Format

SurveyJS-compatible (single page for MVP):

```json
{
  "pages": [{
    "elements": [
      { "type": "text", "name": "question1", "title": "Your Name", "isRequired": true, "placeholder": "Enter name" },
      { "type": "text", "name": "question2", "title": "Email", "inputType": "email", "isRequired": true },
      { "type": "dropdown", "name": "question3", "title": "Country", "choices": ["Canada", "USA"] }
    ]
  }]
}
```

## What Stays the Same

- Toolbar (title editing, save status, publish/unpublish toggle)
- Auto-save logic (3s debounce on change)
- All API routes
- Public form renderer (survey-core + survey-react-ui)
- Submissions dashboard, CSV export
- Builder page server component (`src/app/builder/[id]/page.tsx`)
