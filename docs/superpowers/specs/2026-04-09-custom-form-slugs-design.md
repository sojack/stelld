# Custom Form Slugs

**Date:** 2026-04-09  
**Status:** Approved

## Problem

Public form URLs use UUIDs: `/en/f/b5784f08-f821-42b9-87aa-bc9f0eb69b17`. These are not shareable or memorable. Users want branded URLs like `/en/f/contact-us`.

## Decisions

- **Storage**: `slug` column on the `forms` table (nullable, unique index)
- **Scope**: Global — slugs are unique across all users
- **Plan gate**: PRO and BUSINESS only
- **Backward compatibility**: UUID URLs still work; if the form has a slug, UUID access 301-redirects to the slug URL
- **Builder UI**: Form Settings panel (right sidebar, below banner uploader)

---

## Data Model

Add to `prisma/schema.prisma` → `Form` model:

```prisma
slug String? @unique
```

Migration: `ALTER TABLE forms ADD COLUMN slug TEXT UNIQUE;`

### Slug constraints
- Pattern: `^[a-z0-9-]+$` (lowercase letters, numbers, hyphens)
- Length: 3–60 characters
- Enforced in: API validation + DB unique index

---

## Routing (`src/app/[locale]/f/[id]/page.tsx`)

Single route handles both slug and UUID lookup:

1. Query: `WHERE slug = id OR (id = id AND slug IS NULL OR id = id)`  
   More precisely — two sequential lookups:
   1. `findFirst({ where: { slug: id, isPublished: true } })` → if found, serve
   2. `findFirst({ where: { id, isPublished: true } })` → if found:
      - Has slug? → `redirect` to `/${locale}/f/${form.slug}` (301)
      - No slug? → serve normally
   3. Neither → `notFound()`

---

## API Changes

### `PUT /api/forms/[id]` — extended to accept `slug`

When `body.slug` is present:
1. Check plan (`canCustomizeSlug`) → 403 if not eligible
2. Validate format (`/^[a-z0-9-]+$/`, length 3–60) → 400 if invalid
3. Check uniqueness (excluding current form) → 409 if taken
4. Save

When `body.slug === ""` or `null` → clear the slug (allow removing a custom slug).

### `GET /api/forms/[id]/slug-check?slug=value` — availability check

- Auth required (must own the form)
- Returns `{ available: boolean, error?: string }`
- Checks format validity and uniqueness (excluding current form)
- Used by the builder for instant feedback on blur

---

## Builder UI (`src/components/form-builder.tsx` + new `SlugInput` component)

Location: Form Settings panel (right sidebar, no field selected), below `BannerUploader`.

### `src/components/builder/slug-input.tsx`

Props: `formId`, `currentSlug: string | undefined`, `onSlugChange: (slug: string | null) => void`, `canCustomize: boolean`

Behaviour:
- **Locked state** (FREE): shows `stelld.ca/en/f/your-slug` greyed out with "Available on PRO plan" upgrade link
- **Active state** (PRO/BUSINESS):
  - Text input, placeholder `your-form-slug`
  - Helper text: `stelld.ca/en/f/{slug or "your-form-slug"}`
  - On blur: validate format client-side, then call `GET /api/forms/[id]/slug-check?slug=value`
    - Show inline error if invalid or taken
    - If valid and available: call `PUT /api/forms/[id]` with `{ slug: value }`
    - Call `onSlugChange(value)`
  - Clear button (×): sets slug to null, calls `PUT` with `{ slug: null }`

### `src/components/form-builder.tsx`

- Add `initialSlug: string | undefined` to props (passed from builder page)
- Add `slug` state
- Add `canCustomizeSlug={plan === "PRO" || plan === "BUSINESS"}` prop to `SlugInput`
- Pass `onSlugChange` to update local state

### `src/app/[locale]/builder/[id]/page.tsx`

Pass `initialSlug={form.slug ?? undefined}` to `<FormBuilder>`.

---

## Plan Limits (`src/lib/plans.ts`)

Add `canCustomizeSlug: boolean`:
- FREE: `false`
- PRO: `true`
- BUSINESS: `true`

---

## Critical Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `slug String? @unique` to Form |
| `src/lib/plans.ts` | Add `canCustomizeSlug` |
| `src/app/[locale]/f/[id]/page.tsx` | Dual slug/UUID lookup + redirect |
| `src/app/api/forms/[id]/route.ts` | Accept `slug` in PUT, validate + save |
| `src/app/api/forms/[id]/slug-check/route.ts` | **New** — GET availability check |
| `src/components/builder/slug-input.tsx` | **New** — slug editor component |
| `src/components/form-builder.tsx` | Add slug state + SlugInput to Form Settings |
| `src/app/[locale]/builder/[id]/page.tsx` | Pass `initialSlug` |

---

## Verification

1. Set slug `contact-us` on a form → visit `/en/f/contact-us` → form renders
2. Visit old UUID URL → 301 redirect to `/en/f/contact-us`
3. Try to set same slug on another form → inline error "already taken"
4. Try slug with spaces or capitals → inline error "invalid characters"
5. Clear slug → UUID URL works again, no redirect
6. FREE user → sees locked state in builder
7. Two users can't claim the same slug
