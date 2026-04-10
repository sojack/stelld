# Custom Form Slugs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let PRO/BUSINESS users set a memorable custom URL slug for their form (e.g. `/en/f/contact-us`) instead of the UUID URL, with automatic 301 redirect from the old UUID URL.

**Architecture:** Add a nullable unique `slug` column to the `forms` table. The public form route tries slug lookup first, then UUID lookup with redirect. A new slug-check API route validates availability. A `SlugInput` builder component handles editing with inline feedback.

**Tech Stack:** Next.js 15 App Router, Prisma v6, PostgreSQL, TypeScript, Tailwind CSS

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add `slug String? @unique` to Form |
| `src/lib/plans.ts` | Modify | Add `canCustomizeSlug` to PlanLimits |
| `src/app/api/forms/[id]/route.ts` | Modify | Accept + validate `slug` in PUT handler |
| `src/app/api/forms/[id]/slug-check/route.ts` | Create | GET availability check |
| `src/app/[locale]/f/[id]/page.tsx` | Modify | Dual slug/UUID lookup + permanentRedirect |
| `src/components/builder/slug-input.tsx` | Create | Slug editor with inline availability check |
| `src/components/form-builder.tsx` | Modify | Add slug state + SlugInput to Form Settings panel |
| `src/app/[locale]/builder/[id]/page.tsx` | Modify | Pass `initialSlug` prop |
| `messages/en.json` | Modify | Add slug translation keys |
| `messages/fr.json` | Modify | Add slug translation keys |

---

## Task 1: DB migration — add slug column

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add slug field to Form model**

In `prisma/schema.prisma`, find the `Form` model and add `slug` after `isPublished`:

```prisma
model Form {
  id          String   @id @default(uuid())
  userId      String
  title       String   @default("Untitled Form")
  description String?
  slug        String?  @unique
  schema      Json     @default("{}")
  settings    Json     @default("{}")
  isPublished Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  submissions Submission[]

  @@index([userId])
  @@map("forms")
}
```

- [ ] **Step 2: Create and apply migration**

```bash
npx prisma migrate dev --name add_form_slug
```

Expected output: `✔  Your database is now in sync with your schema.`

- [ ] **Step 3: Verify migration file was created**

```bash
ls prisma/migrations/ | tail -3
```

Expected: a new folder ending in `_add_form_slug`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add slug column to forms table"
```

---

## Task 2: Plan limits

**Files:**
- Modify: `src/lib/plans.ts`

- [ ] **Step 1: Add `canCustomizeSlug` to interface and all plans**

Replace the contents of `src/lib/plans.ts`:

```typescript
import { Plan } from "@/generated/prisma/client";

export interface PlanLimits {
  maxForms: number;
  maxSubmissionsPerMonth: number;
  canCollectPayments: boolean;
  canUploadBanner: boolean;
  canCustomizeSlug: boolean;
  maxStorageMB: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxForms: 5,
    maxSubmissionsPerMonth: 100,
    canCollectPayments: false,
    canUploadBanner: false,
    canCustomizeSlug: false,
    maxStorageMB: 100,
  },
  PRO: {
    maxForms: 50,
    maxSubmissionsPerMonth: 1000,
    canCollectPayments: false,
    canUploadBanner: true,
    canCustomizeSlug: true,
    maxStorageMB: 1024,
  },
  BUSINESS: {
    maxForms: Infinity,
    maxSubmissionsPerMonth: 10000,
    canCollectPayments: true,
    canUploadBanner: true,
    canCustomizeSlug: true,
    maxStorageMB: 10240,
  },
};

export function getPlanLimits(plan: Plan | undefined | null): PlanLimits {
  return PLAN_LIMITS[plan ?? "FREE"];
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add src/lib/plans.ts
git commit -m "feat: add canCustomizeSlug to plan limits"
```

---

## Task 3: Slug validation helper

**Files:**
- Create: `src/lib/slug.ts`

- [ ] **Step 1: Create slug validation utility**

```typescript
// src/lib/slug.ts

export const SLUG_REGEX = /^[a-z0-9-]+$/;
export const SLUG_MIN = 3;
export const SLUG_MAX = 60;

export function validateSlug(slug: string): string | null {
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    return `Must be between ${SLUG_MIN} and ${SLUG_MAX} characters`;
  }
  if (!SLUG_REGEX.test(slug)) {
    return "Use only lowercase letters, numbers, and hyphens";
  }
  return null; // valid
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/slug.ts
git commit -m "feat: add slug validation utility"
```

---

## Task 4: Slug-check API route

**Files:**
- Create: `src/app/api/forms/[id]/slug-check/route.ts`

- [ ] **Step 1: Create route**

```typescript
// src/app/api/forms/[id]/slug-check/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateSlug } from "@/lib/slug";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify form ownership
  const form = await prisma.form.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") ?? "";

  const validationError = validateSlug(slug);
  if (validationError) {
    return NextResponse.json({ available: false, error: validationError });
  }

  // Check uniqueness, excluding the current form
  const existing = await prisma.form.findFirst({
    where: { slug, NOT: { id } },
  });

  return NextResponse.json({ available: !existing });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Manual verify**

Start dev server (`npm run dev`), then in a browser console or terminal:

```bash
curl "http://localhost:3000/api/forms/SOME_FORM_ID/slug-check?slug=test-slug" \
  -H "Cookie: <your session cookie>"
```

Expected: `{"available":true}` for an unclaimed slug.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/forms/[id]/slug-check/route.ts
git commit -m "feat: add slug availability check API route"
```

---

## Task 5: Accept slug in PUT /api/forms/[id]

**Files:**
- Modify: `src/app/api/forms/[id]/route.ts`

- [ ] **Step 1: Update PUT handler to accept slug**

Replace the PUT handler in `src/app/api/forms/[id]/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getPlanLimits } from "@/lib/plans";
import { validateSlug } from "@/lib/slug";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  // Handle slug update
  if (body.slug !== undefined) {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: session.user.id },
    });
    const limits = getPlanLimits(subscription?.plan);
    if (!limits.canCustomizeSlug) {
      return NextResponse.json({ error: "Upgrade to PRO to use custom URLs" }, { status: 403 });
    }

    // null or empty string clears the slug
    if (body.slug === null || body.slug === "") {
      await prisma.form.updateMany({
        where: { id, userId: session.user.id },
        data: { slug: null },
      });
      return NextResponse.json({ success: true });
    }

    const validationError = validateSlug(body.slug);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    // Check uniqueness excluding this form
    const existing = await prisma.form.findFirst({
      where: { slug: body.slug, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "This URL is already taken" }, { status: 409 });
    }

    await prisma.form.updateMany({
      where: { id, userId: session.user.id },
      data: { slug: body.slug },
    });
    return NextResponse.json({ success: true });
  }

  // Existing non-slug fields
  const form = await prisma.form.updateMany({
    where: { id, userId: session.user.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.schema !== undefined && { schema: body.schema }),
      ...(body.settings !== undefined && { settings: body.settings }),
      ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });

  if (form.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
```

Keep the existing `GET` and `DELETE` handlers unchanged.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/forms/[id]/route.ts
git commit -m "feat: accept slug field in forms PUT API"
```

---

## Task 6: Public form route — dual lookup + redirect

**Files:**
- Modify: `src/app/[locale]/f/[id]/page.tsx`

- [ ] **Step 1: Update public form page**

Replace the full contents of `src/app/[locale]/f/[id]/page.tsx`:

```typescript
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { permanentRedirect } from "next/navigation";
import { FormRenderer } from "@/components/form-renderer";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  // Try slug lookup first
  let form = await prisma.form.findFirst({
    where: { slug: id, isPublished: true },
  });

  if (!form) {
    // Fall back to UUID lookup
    form = await prisma.form.findFirst({
      where: { id, isPublished: true },
    });

    if (!form) notFound();

    // If accessed by UUID but form has a slug, redirect permanently
    if (form.slug) {
      permanentRedirect(`/${locale}/f/${form.slug}`);
    }
  }

  const settings = form.settings as { thankYouMessage?: string; bannerUrl?: string };

  return (
    <FormRenderer
      formId={form.id}
      schema={form.schema as object}
      title={form.title}
      description={form.description ?? ""}
      thankYouMessage={settings.thankYouMessage}
      bannerUrl={settings.bannerUrl}
      locale={locale}
    />
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Manual verify**

With dev server running, set a slug on a test form directly in the DB:

```sql
UPDATE forms SET slug = 'test-slug' WHERE id = 'YOUR_FORM_UUID';
```

Then:
- Visit `/en/f/test-slug` → form renders ✓
- Visit `/en/f/YOUR_FORM_UUID` → browser redirects to `/en/f/test-slug` ✓

- [ ] **Step 4: Commit**

```bash
git add src/app/[locale]/f/[id]/page.tsx
git commit -m "feat: add slug routing and UUID redirect for public forms"
```

---

## Task 7: SlugInput component

**Files:**
- Create: `src/components/builder/slug-input.tsx`

- [ ] **Step 1: Create component**

```typescript
// src/components/builder/slug-input.tsx
"use client";

import { useState, useRef } from "react";

interface SlugInputProps {
  formId: string;
  currentSlug: string | undefined;
  onSlugChange: (slug: string | null) => void;
  canCustomize: boolean;
}

const SLUG_REGEX = /^[a-z0-9-]+$/;

export function SlugInput({ formId, currentSlug, onSlugChange, canCustomize }: SlugInputProps) {
  const [value, setValue] = useState(currentSlug ?? "");
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const lastChecked = useRef("");

  if (!canCustomize) {
    return (
      <div className="rounded-md border border-dashed border-gray-200 p-4 text-center">
        <p className="text-xs text-gray-500 mb-1">Custom URL</p>
        <p className="text-xs text-gray-400">
          Available on{" "}
          <a href="/en/dashboard/billing" className="text-green-700 underline">
            PRO plan
          </a>
        </p>
      </div>
    );
  }

  async function handleBlur() {
    const slug = value.trim();

    // No change
    if (slug === (currentSlug ?? "")) return;

    // Clear slug
    if (slug === "") {
      setSaving(true);
      await fetch(`/api/forms/${formId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: null }),
      });
      setSaving(false);
      setStatus("idle");
      onSlugChange(null);
      return;
    }

    // Client-side format check
    if (slug.length < 3 || slug.length > 60 || !SLUG_REGEX.test(slug)) {
      setStatus("invalid");
      setErrorMsg("Use only lowercase letters, numbers, and hyphens (3–60 characters)");
      return;
    }

    // Availability check
    setStatus("checking");
    lastChecked.current = slug;
    const res = await fetch(`/api/forms/${formId}/slug-check?slug=${encodeURIComponent(slug)}`);
    const { available, error } = await res.json();

    if (slug !== lastChecked.current) return; // stale

    if (error) {
      setStatus("invalid");
      setErrorMsg(error);
      return;
    }

    if (!available) {
      setStatus("taken");
      setErrorMsg("This URL is already taken");
      return;
    }

    // Save
    setSaving(true);
    const saveRes = await fetch(`/api/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    setSaving(false);

    if (!saveRes.ok) {
      const { error: saveErr } = await saveRes.json();
      setStatus("invalid");
      setErrorMsg(saveErr ?? "Failed to save");
      return;
    }

    setStatus("available");
    onSlugChange(slug);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    setStatus("idle");
    setErrorMsg("");
  }

  async function handleClear() {
    setValue("");
    setStatus("idle");
    setErrorMsg("");
    await fetch(`/api/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: null }),
    });
    onSlugChange(null);
  }

  const displaySlug = value.trim() || "your-form-slug";

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-900">Custom URL</label>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="your-form-slug"
          className={`w-full border rounded px-3 py-1.5 text-sm text-gray-900 pr-7 ${
            status === "invalid" || status === "taken"
              ? "border-red-400 focus:ring-red-300"
              : status === "available"
              ? "border-green-400 focus:ring-green-300"
              : "border-gray-300"
          }`}
        />
        {value && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
            type="button"
          >
            ×
          </button>
        )}
      </div>

      <p className="text-xs text-gray-400">
        stelld.ca/en/f/<span className="text-gray-600">{displaySlug}</span>
      </p>

      {status === "checking" && (
        <p className="text-xs text-gray-400">Checking availability…</p>
      )}
      {saving && (
        <p className="text-xs text-gray-400">Saving…</p>
      )}
      {status === "available" && !saving && (
        <p className="text-xs text-green-600">URL saved</p>
      )}
      {(status === "invalid" || status === "taken") && (
        <p className="text-xs text-red-500">{errorMsg}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/builder/slug-input.tsx
git commit -m "feat: add SlugInput builder component"
```

---

## Task 8: Wire SlugInput into FormBuilder

**Files:**
- Modify: `src/components/form-builder.tsx`
- Modify: `src/app/[locale]/builder/[id]/page.tsx`

- [ ] **Step 1: Add import and prop to FormBuilder**

At the top of `src/components/form-builder.tsx`, add import after the BannerUploader import:

```typescript
import { SlugInput } from "./builder/slug-input";
```

In the `FormBuilderProps` interface, add:

```typescript
initialSlug: string | undefined;
```

In the `FormBuilder` function signature, add `initialSlug` to destructured props:

```typescript
export function FormBuilder({ formId, initialSchema, initialTitle, initialDescription, initialSettings, initialSlug, isPublished, locale, plan }: FormBuilderProps) {
```

- [ ] **Step 2: Add slug state**

After the `settings` state line, add:

```typescript
const [slug, setSlug] = useState<string | undefined>(initialSlug);
```

- [ ] **Step 3: Add SlugInput to Form Settings panel**

In the right panel's "no field selected" section, add `SlugInput` after `BannerUploader`:

```tsx
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
```

- [ ] **Step 4: Update builder page to pass initialSlug**

In `src/app/[locale]/builder/[id]/page.tsx`, add `initialSlug` prop to `<FormBuilder>`:

```tsx
<FormBuilder
  formId={form.id}
  initialSchema={form.schema as object}
  initialTitle={form.title}
  initialDescription={form.description ?? ""}
  initialSettings={(form.settings as { bannerUrl?: string; thankYouMessage?: string }) ?? {}}
  initialSlug={form.slug ?? undefined}
  isPublished={form.isPublished}
  locale={locale}
  plan={subscription?.plan ?? "FREE"}
/>
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/components/form-builder.tsx src/app/[locale]/builder/[id]/page.tsx
git commit -m "feat: integrate SlugInput into form builder settings panel"
```

---

## Task 9: Deploy and end-to-end verify

- [ ] **Step 1: Push to remote**

```bash
git push
```

- [ ] **Step 2: Deploy on server**

```bash
git pull && docker build -t stelld . && docker stop stelld && docker rm stelld && docker run -d --name stelld --network host --env-file .env stelld
```

- [ ] **Step 3: Run DB migration on production**

The migration was already applied to the dev DB. Apply to production:

```bash
docker exec -it stelld sh -c "cd /app && npx prisma migrate deploy"
```

Expected: `1 migration applied.`

- [ ] **Step 4: End-to-end checklist**

- [ ] Open builder as BUSINESS user, click canvas background → see "Custom URL" section in right panel
- [ ] Type `contact-us` → blur → "URL saved" appears
- [ ] Visit `stelld.ca/en/f/contact-us` → form renders correctly
- [ ] Visit `stelld.ca/en/f/UUID` → browser redirects to `/en/f/contact-us`
- [ ] Try setting same slug on a different form → "This URL is already taken"
- [ ] Try `Contact Us` (capitals/spaces) → "Use only lowercase letters..."
- [ ] Click × to clear slug → UUID URL works again with no redirect
- [ ] Log in as FREE user → see "Available on PRO plan" locked state
