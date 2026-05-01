# Team Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add team collaboration so account owners can invite Viewer/Editor members, with email invites, an account switcher, and per-account scoping for forms/submissions.

**Architecture:** Introduce `Account`, `AccountMember`, `Invite` tables. Every existing user gets a personal account on migration. Forms move from `User.id` ownership to `Account.id` ownership (keeping `Form.userId` as `createdBy` for history). A single `getAccountAccess` helper resolves a user's role in an account; every API route and dashboard page uses it. The active account is selected via a `stelld_account` cookie set by the new account switcher.

**Tech Stack:** Next.js 15 App Router, Prisma 6, Auth.js v5, AWS SES (existing email infra), next-intl (i18n), Tailwind CSS.

**Spec:** `docs/superpowers/specs/2026-04-30-team-collaboration-design.md`

**Testing convention:** This project has no automated test suite. Each task ends with **manual verification commands** (curl/Prisma queries/UI smoke checks) and a **commit step**. Verification is mandatory — do not skip.

**Important conventions:**
- Prisma client imports from `@/generated/prisma/client` (NOT `@prisma/client`).
- Prisma migration commands: use `npx prisma migrate dev --name <name>` for local dev, `npx prisma migrate deploy` in prod.
- Email sending uses AWS SES via `src/lib/email.ts`, NOT Resend (despite the spec mentioning Resend — code uses SES).
- All client routing/links must use `Link`/`useRouter`/`usePathname`/`redirect` from `@/i18n/routing`, not from `next/link` etc.
- Translations go in `messages/en.json` and `messages/fr.json` under a new `members` namespace.

---

## Phase 1: Schema & Foundation

### Task 1: Add Prisma schema for Account, AccountMember, Invite, MemberRole

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models and update Form**

Open `prisma/schema.prisma`. Add the new models, enum, and `accountId` to `Form`. Also add the `accounts`, `accountMemberships`, and `ownedAccount` relations to `User`.

Replace the existing `User` model relations block to add account relations:

```prisma
model User {
  id            String    @id @default(uuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  password      String?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts          Account[]
  sessions          Session[]
  forms             Form[]

  ownedAccount       Account?         @relation("AccountOwner")
  accountMemberships AccountMember[]

  subscription  Subscription?
  stripeConnect StripeConnect?

  @@map("users")
}
```

Update `Form` to add `accountId` (NOT NULL — backfilled in Task 2's data migration). Keep `userId` as createdBy:

```prisma
model Form {
  id          String   @id @default(uuid())
  userId      String
  accountId   String
  title       String   @default("Untitled Form")
  description String?
  slug        String?  @unique
  schema      Json     @default("{}")
  settings    Json     @default("{}")
  isPublished Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  account     Account      @relation(fields: [accountId], references: [id], onDelete: Cascade)
  submissions Submission[]

  @@index([userId])
  @@index([accountId])
  @@map("forms")
}
```

Append at the end of the file (after `StripeConnect`):

```prisma
enum MemberRole {
  VIEWER
  EDITOR
}

model Account {
  id        String   @id @default(uuid())
  ownerId   String   @unique
  name      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  owner   User            @relation("AccountOwner", fields: [ownerId], references: [id], onDelete: Cascade)
  members AccountMember[]
  invites Invite[]
  forms   Form[]

  @@map("accounts")
}

model AccountMember {
  id        String     @id @default(uuid())
  accountId String
  userId    String
  role      MemberRole
  createdAt DateTime   @default(now())

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([accountId, userId])
  @@index([userId])
  @@map("account_members")
}

model Invite {
  id         String     @id @default(uuid())
  accountId  String
  email      String
  role       MemberRole
  token      String     @unique
  expiresAt  DateTime
  acceptedAt DateTime?
  invitedBy  String
  createdAt  DateTime   @default(now())

  account Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@unique([accountId, email])
  @@index([email])
  @@map("invites")
}
```

- [ ] **Step 2: Verify schema parses**

```bash
npx prisma format
npx prisma validate
```

Expected: both succeed silently.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add Account, AccountMember, Invite models"
```

---

### Task 2: Generate migration that creates tables AND backfills existing data

**Files:**
- Create: `prisma/migrations/<timestamp>_team_collaboration/migration.sql`

Prisma's `migrate dev` will autogenerate most of this, but we must manually edit the generated SQL to insert the backfill BEFORE the NOT NULL constraint is applied to `Form.accountId`.

- [ ] **Step 1: Generate the migration in --create-only mode**

```bash
npx prisma migrate dev --name team_collaboration --create-only
```

This creates the migration directory but does not apply it. Output: `Prisma Migrate created the following migration without applying it: <timestamp>_team_collaboration`

- [ ] **Step 2: Edit the migration to add backfill steps**

Open the newly created `prisma/migrations/<timestamp>_team_collaboration/migration.sql`.

The autogenerated SQL will:
1. Create `MemberRole` enum
2. Create `accounts`, `account_members`, `invites` tables
3. Add `accountId` column to `forms` (likely as NOT NULL — Prisma will fail to apply if data exists)

Modify the file so that the order is:
1. Create enum + new tables (keep autogenerated)
2. Add `accountId` to `forms` as **nullable**
3. Backfill: create one Account per existing User; populate `forms.accountId`
4. Alter `forms.accountId` to NOT NULL
5. Add foreign key + index (keep autogenerated)

Final migration SQL should look approximately like this (adjust field names if Prisma generates them differently — preserve the autogenerated structure, only insert the backfill steps and split the column add):

```sql
-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('VIEWER', 'EDITOR');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_members" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_ownerId_key" ON "accounts"("ownerId");
CREATE UNIQUE INDEX "account_members_accountId_userId_key" ON "account_members"("accountId", "userId");
CREATE INDEX "account_members_userId_idx" ON "account_members"("userId");
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");
CREATE INDEX "invites_email_idx" ON "invites"("email");
CREATE UNIQUE INDEX "invites_accountId_email_key" ON "invites"("accountId", "email");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "invites" ADD CONSTRAINT "invites_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add accountId to forms (nullable for backfill)
ALTER TABLE "forms" ADD COLUMN "accountId" TEXT;

-- Backfill: one Account per existing User
INSERT INTO "accounts" ("id", "ownerId", "name", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  u."id",
  COALESCE(u."name", u."email") || '''s account',
  NOW(),
  NOW()
FROM "users" u
WHERE NOT EXISTS (SELECT 1 FROM "accounts" a WHERE a."ownerId" = u."id");

-- Backfill: forms.accountId = the account owned by forms.userId
UPDATE "forms" f
SET "accountId" = a."id"
FROM "accounts" a
WHERE a."ownerId" = f."userId" AND f."accountId" IS NULL;

-- Now make accountId NOT NULL
ALTER TABLE "forms" ALTER COLUMN "accountId" SET NOT NULL;

-- Index + FK on forms.accountId
CREATE INDEX "forms_accountId_idx" ON "forms"("accountId");
ALTER TABLE "forms" ADD CONSTRAINT "forms_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

If `gen_random_uuid()` is not available, ensure `pgcrypto` extension is enabled. For RDS Postgres 16 it's available by default; if errors occur add `CREATE EXTENSION IF NOT EXISTS pgcrypto;` at the top of the migration.

- [ ] **Step 2: Apply the migration**

```bash
npx prisma migrate dev
```

Expected: "Database is now in sync with your schema." Generates `src/generated/prisma/client`.

- [ ] **Step 3: Manually verify the backfill in psql or Prisma Studio**

```bash
npx prisma studio
```

Or query directly:

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) AS users, (SELECT COUNT(*) FROM accounts) AS accounts FROM users;"
```

Expected: `users` count equals `accounts` count.

```bash
psql $DATABASE_URL -c "SELECT COUNT(*) AS forms_total, COUNT(\"accountId\") AS forms_with_account FROM forms;"
```

Expected: both numbers equal.

- [ ] **Step 4: Commit**

```bash
git add prisma/migrations/
git commit -m "feat: migration for accounts, members, invites, backfill existing forms"
```

---

### Task 3: Add maxMembers to plan limits

**Files:**
- Modify: `src/lib/plans.ts`

- [ ] **Step 1: Add the field to PlanLimits and each tier**

Replace the contents of `src/lib/plans.ts`:

```ts
import { Plan } from "@/generated/prisma/client";

export interface PlanLimits {
  maxForms: number;
  maxSubmissionsPerMonth: number;
  maxMembers: number;
  canCollectPayments: boolean;
  canUploadBanner: boolean;
  canCustomizeSlug: boolean;
  maxStorageMB: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  FREE: {
    maxForms: 5,
    maxSubmissionsPerMonth: 100,
    maxMembers: 1,
    canCollectPayments: false,
    canUploadBanner: false,
    canCustomizeSlug: false,
    maxStorageMB: 100,
  },
  PRO: {
    maxForms: 50,
    maxSubmissionsPerMonth: 1000,
    maxMembers: 5,
    canCollectPayments: false,
    canUploadBanner: true,
    canCustomizeSlug: true,
    maxStorageMB: 1024,
  },
  BUSINESS: {
    maxForms: Infinity,
    maxSubmissionsPerMonth: 10000,
    maxMembers: Infinity,
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

- [ ] **Step 2: Verify types**

```bash
npx tsc --noEmit
```

Expected: no errors related to plans.ts.

- [ ] **Step 3: Commit**

```bash
git add src/lib/plans.ts
git commit -m "feat: add maxMembers to plan limits"
```

---

### Task 4: Build access control helper

**Files:**
- Create: `src/lib/access.ts`

- [ ] **Step 1: Write the helper module**

Create `src/lib/access.ts`:

```ts
import { prisma } from "@/lib/db";
import type { Form } from "@/generated/prisma/client";

export type Role = "OWNER" | "EDITOR" | "VIEWER";

export type Action =
  | "VIEW_FORM"
  | "CREATE_FORM"
  | "EDIT_FORM"
  | "DELETE_FORM"
  | "VIEW_SUBMISSIONS"
  | "EXPORT_SUBMISSIONS"
  | "DELETE_SUBMISSIONS"
  | "MANAGE_BILLING"
  | "MANAGE_MEMBERS";

const PERMISSIONS: Record<Role, Set<Action>> = {
  OWNER: new Set([
    "VIEW_FORM",
    "CREATE_FORM",
    "EDIT_FORM",
    "DELETE_FORM",
    "VIEW_SUBMISSIONS",
    "EXPORT_SUBMISSIONS",
    "DELETE_SUBMISSIONS",
    "MANAGE_BILLING",
    "MANAGE_MEMBERS",
  ]),
  EDITOR: new Set([
    "VIEW_FORM",
    "CREATE_FORM",
    "EDIT_FORM",
    "VIEW_SUBMISSIONS",
    "EXPORT_SUBMISSIONS",
  ]),
  VIEWER: new Set([
    "VIEW_FORM",
    "VIEW_SUBMISSIONS",
    "EXPORT_SUBMISSIONS",
  ]),
};

export function can(role: Role | null, action: Action): boolean {
  if (!role) return false;
  return PERMISSIONS[role].has(action);
}

export async function getAccountAccess(
  userId: string,
  accountId: string
): Promise<Role | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { ownerId: true },
  });
  if (!account) return null;
  if (account.ownerId === userId) return "OWNER";

  const member = await prisma.accountMember.findUnique({
    where: { accountId_userId: { accountId, userId } },
    select: { role: true },
  });
  if (!member) return null;
  return member.role as Role;
}

export async function getFormAccess(
  userId: string,
  formId: string
): Promise<{ form: Form; role: Role } | null> {
  const form = await prisma.form.findUnique({ where: { id: formId } });
  if (!form) return null;
  const role = await getAccountAccess(userId, form.accountId);
  if (!role) return null;
  return { form, role };
}

/** List every account the user can access — owned + member of. */
export async function listAccessibleAccounts(userId: string) {
  const owned = await prisma.account.findFirst({ where: { ownerId: userId } });
  const memberships = await prisma.accountMember.findMany({
    where: { userId },
    include: { account: true },
  });

  const ownedItem = owned ? { account: owned, role: "OWNER" as const } : null;
  const memberItems = memberships.map((m) => ({
    account: m.account,
    role: m.role as Role,
  }));

  return ownedItem ? [ownedItem, ...memberItems] : memberItems;
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/access.ts
git commit -m "feat: add access control helper for accounts and roles"
```

---

### Task 5: Build active-account context resolver

**Files:**
- Create: `src/lib/account-context.ts`

This resolves "which account is the current request scoped to?" from a cookie, falling back to the user's personal account.

- [ ] **Step 1: Write the resolver**

Create `src/lib/account-context.ts`:

```ts
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getAccountAccess, type Role } from "@/lib/access";

export const ACCOUNT_COOKIE = "stelld_account";

export interface AccountContext {
  accountId: string;
  role: Role;
  isPersonal: boolean;
}

/**
 * Resolves the active account for the given user.
 * Reads the cookie, validates the user can access that account, falls back to personal.
 * Returns null only if the user has no accessible account at all (shouldn't happen for authenticated users).
 */
export async function getActiveAccount(userId: string): Promise<AccountContext | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(ACCOUNT_COOKIE)?.value;

  if (cookieValue) {
    const role = await getAccountAccess(userId, cookieValue);
    if (role) {
      const personal = await prisma.account.findUnique({
        where: { ownerId: userId },
        select: { id: true },
      });
      return {
        accountId: cookieValue,
        role,
        isPersonal: personal?.id === cookieValue,
      };
    }
    // Cookie points to inaccessible account — fall through to personal.
  }

  const personal = await prisma.account.findUnique({
    where: { ownerId: userId },
    select: { id: true },
  });
  if (!personal) return null;
  return { accountId: personal.id, role: "OWNER", isPersonal: true };
}

/**
 * Server-side helper to set the active account cookie.
 * Call from server actions or route handlers.
 */
export async function setActiveAccountCookie(accountId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACCOUNT_COOKIE, accountId, {
    path: "/",
    httpOnly: false, // readable by client switcher
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/account-context.ts
git commit -m "feat: add active-account context resolver"
```

---

## Phase 2: Refactor Form & Submission APIs to Use Account Scoping

### Task 6: Refactor /api/forms route (list + create)

**Files:**
- Modify: `src/app/api/forms/route.ts`

- [ ] **Step 1: Replace the file**

Replace `src/app/api/forms/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPlanLimits } from "@/lib/plans";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx) {
    return NextResponse.json({ error: "No account" }, { status: 404 });
  }

  const forms = await prisma.form.findMany({
    where: { accountId: ctx.accountId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { submissions: true } },
      user: { select: { name: true, email: true } },
    },
  });

  return NextResponse.json(forms);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx) {
    return NextResponse.json({ error: "No account" }, { status: 404 });
  }
  if (!can(ctx.role, "CREATE_FORM")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Plan limits enforced against the OWNER of the active account.
  const account = await prisma.account.findUnique({
    where: { id: ctx.accountId },
    select: { ownerId: true },
  });
  if (!account) {
    return NextResponse.json({ error: "No account" }, { status: 404 });
  }
  const subscription = await prisma.subscription.findUnique({
    where: { userId: account.ownerId },
  });
  const limits = getPlanLimits(subscription?.plan);
  const formCount = await prisma.form.count({ where: { accountId: ctx.accountId } });
  if (formCount >= limits.maxForms) {
    return NextResponse.json({ error: "FORM_LIMIT_REACHED" }, { status: 403 });
  }

  const form = await prisma.form.create({
    data: {
      userId: session.user.id, // createdBy
      accountId: ctx.accountId,
      title: "Untitled Form",
      schema: {},
      settings: { thankYouMessage: "Thank you for your submission!" },
    },
  });

  return NextResponse.json(form, { status: 201 });
}
```

- [ ] **Step 2: Manually verify**

Start dev server: `npm run dev` (in another terminal).

Smoke test as the existing logged-in user (assuming you have a session in the browser):

```bash
curl -s http://localhost:3000/api/forms -H "Cookie: $(grep -E 'authjs|next-auth' ~/.cookies | head)" | jq length
```

Or just refresh the dashboard at http://localhost:3000/dashboard and confirm the forms list still loads with all your existing forms.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/forms/route.ts
git commit -m "refactor: scope /api/forms to active account"
```

---

### Task 7: Refactor /api/forms/[id] route (GET, PUT, DELETE)

**Files:**
- Modify: `src/app/api/forms/[id]/route.ts`

- [ ] **Step 1: Replace the file**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getFormAccess } from "@/lib/access";
import { can } from "@/lib/access";
import { getPlanLimits } from "@/lib/plans";
import { validateSlug } from "@/lib/slug";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getFormAccess(session.user.id, id);
  if (!access || !can(access.role, "VIEW_FORM")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ...access.form, _role: access.role });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getFormAccess(session.user.id, id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!can(access.role, "EDIT_FORM")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  // Slug update path.
  if (body.slug !== undefined) {
    const account = await prisma.account.findUnique({
      where: { id: access.form.accountId },
      select: { ownerId: true },
    });
    const subscription = await prisma.subscription.findUnique({
      where: { userId: account!.ownerId },
    });
    const limits = getPlanLimits(subscription?.plan);
    if (!limits.canCustomizeSlug) {
      return NextResponse.json({ error: "Upgrade to PRO to use custom URLs" }, { status: 403 });
    }

    if (body.slug === null || body.slug === "") {
      await prisma.form.update({ where: { id }, data: { slug: null } });
      return NextResponse.json({ success: true });
    }

    const validationError = validateSlug(body.slug);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const existing = await prisma.form.findFirst({
      where: { slug: body.slug, NOT: { id } },
    });
    if (existing) {
      return NextResponse.json({ error: "This URL is already taken" }, { status: 409 });
    }

    await prisma.form.update({ where: { id }, data: { slug: body.slug } });
    return NextResponse.json({ success: true });
  }

  // Generic field update.
  await prisma.form.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.schema !== undefined && { schema: body.schema }),
      ...(body.settings !== undefined && { settings: body.settings }),
      ...(body.isPublished !== undefined && { isPublished: body.isPublished }),
      ...(body.description !== undefined && { description: body.description }),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const access = await getFormAccess(session.user.id, id);
  if (!access) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!can(access.role, "DELETE_FORM")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.form.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Manually verify**

In the browser, open an existing form's builder page; confirm it loads. Edit the title, save, refresh — confirm changes persist. (You're the owner so all permissions pass.)

- [ ] **Step 3: Commit**

```bash
git add src/app/api/forms/[id]/route.ts
git commit -m "refactor: scope /api/forms/[id] to active account with role checks"
```

---

### Task 8: Refactor remaining /api/forms/[id]/* routes

**Files:**
- Modify: `src/app/api/forms/[id]/duplicate/route.ts`
- Modify: `src/app/api/forms/[id]/submissions/route.ts`
- Modify: `src/app/api/forms/[id]/submissions/export/route.ts`
- Modify: `src/app/api/forms/[id]/banner/route.ts`
- Modify: `src/app/api/forms/[id]/slug-check/route.ts`

The pattern: replace `userId: session.user.id` filters with `getFormAccess` + the appropriate `can()` check.

- [ ] **Step 1: Read each file**

```bash
cat src/app/api/forms/[id]/duplicate/route.ts
cat src/app/api/forms/[id]/submissions/route.ts
cat src/app/api/forms/[id]/submissions/export/route.ts
cat src/app/api/forms/[id]/banner/route.ts
cat src/app/api/forms/[id]/slug-check/route.ts
```

- [ ] **Step 2: For `duplicate/route.ts`**

Replace any `findFirst({ where: { id, userId: session.user.id }})` with:

```ts
import { getFormAccess, can } from "@/lib/access";
import { getActiveAccount } from "@/lib/account-context";
// ...
const access = await getFormAccess(session.user.id, id);
if (!access) return NextResponse.json({ error: "Not found" }, { status: 404 });
if (!can(access.role, "CREATE_FORM")) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
// When creating the duplicate, set accountId = access.form.accountId, userId = session.user.id (createdBy)
```

Apply plan limits the same way as Task 6 (against the account owner).

- [ ] **Step 3: For `submissions/route.ts` and `submissions/export/route.ts`**

These are GET-only listing/exporting submissions of a form.

Replace ownership filter with:

```ts
const access = await getFormAccess(session.user.id, id);
if (!access || !can(access.role, "VIEW_SUBMISSIONS")) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
```

For `submissions/route.ts` if it has a DELETE method for individual submissions, gate that with `DELETE_SUBMISSIONS`.

- [ ] **Step 4: For `banner/route.ts`**

POST/DELETE for form banner. Gate with `EDIT_FORM`. Plan limit check (`canUploadBanner`) reads from the account owner's subscription, not the acting user's.

```ts
const access = await getFormAccess(session.user.id, id);
if (!access || !can(access.role, "EDIT_FORM")) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
const account = await prisma.account.findUnique({
  where: { id: access.form.accountId },
  select: { ownerId: true },
});
const subscription = await prisma.subscription.findUnique({
  where: { userId: account!.ownerId },
});
const limits = getPlanLimits(subscription?.plan);
if (!limits.canUploadBanner) {
  return NextResponse.json({ error: "Upgrade to PRO" }, { status: 403 });
}
```

- [ ] **Step 5: For `slug-check/route.ts`**

This is just a uniqueness check, no real ownership gating beyond auth. Replace `userId` filter (if present) with `getFormAccess` + `EDIT_FORM`.

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Manually verify**

In the browser: duplicate a form (confirm new form appears), open submissions tab, export CSV (confirm download), upload a banner (if PRO+).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/forms/[id]/
git commit -m "refactor: scope form sub-routes to active account with role checks"
```

---

### Task 9: Refactor /api/submissions (public POST) and any standalone submission routes

**Files:**
- Modify: `src/app/api/submissions/route.ts`

The public submission endpoint receives a `formId` and creates a Submission. It does NOT require auth and does NOT need role checks — anyone can submit a form. But the form's owner email (for notifications) now resolves through the **account owner**, not `Form.userId` directly.

- [ ] **Step 1: Read the existing file**

```bash
cat src/app/api/submissions/route.ts
```

- [ ] **Step 2: Update notification recipient lookup**

Find where it reads `form.user.email` (or similar) for `sendSubmissionNotification`. Change to look up the form's account owner:

```ts
const form = await prisma.form.findUnique({
  where: { id: formId },
  include: { account: { include: { owner: { select: { email: true } } } } },
});
// ...
if (form.account.owner.email) {
  await sendSubmissionNotification(form.account.owner.email, ...);
}
```

If the existing code already uses `form.user.email` and you want to preserve behavior of "owner gets the email" per the spec, keep it as the account owner.

Plan-limit enforcement (submissions/month cap) similarly reads from `account.owner`'s subscription.

- [ ] **Step 3: Manually verify**

Open a published form in an incognito browser at `/f/<id>`, submit it, confirm submission appears in the dashboard.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/submissions/route.ts
git commit -m "refactor: route submission notifications through account owner"
```

---

### Task 10: Gate /api/billing/* routes to owner-only

**Files:**
- Modify: `src/app/api/billing/status/route.ts`
- Modify: `src/app/api/billing/checkout/route.ts`
- Modify: `src/app/api/billing/portal/route.ts`
- Modify: `src/app/api/billing/connect/route.ts`
- Modify: `src/app/api/billing/payment-session/route.ts`

Billing is per-user (subscription belongs to the User, not the Account). The point of gating here is: a member of someone else's account, when their cookie points to that other account, shouldn't see the *owner's* billing info. Easiest approach: billing endpoints always operate on the **logged-in user's own subscription** (regardless of cookie). They're effectively "my billing."

- [ ] **Step 1: Audit each route**

```bash
cat src/app/api/billing/status/route.ts
cat src/app/api/billing/checkout/route.ts
cat src/app/api/billing/portal/route.ts
cat src/app/api/billing/connect/route.ts
cat src/app/api/billing/payment-session/route.ts
```

These already use `session.user.id` to find subscriptions. They are already correctly scoped to "my billing." **No code change needed for the API routes themselves** — the existing behavior is correct.

The UI-side gating happens in Task 21 (redirect non-personal-account viewers away from `/dashboard/billing`).

- [ ] **Step 2: Confirm by reading**

Verify each `billing/*/route.ts` queries Subscription/StripeConnect by `session.user.id`. If any of them looked up a form's subscription and tried to scope to "the account's billing," that would be a bug. As of pre-refactor, they don't.

- [ ] **Step 3: Commit (no-op)**

No changes — proceed without commit.

---

## Phase 3: Member & Invite APIs

### Task 11: Members API — list, change role, remove

**Files:**
- Create: `src/app/api/members/route.ts`
- Create: `src/app/api/members/[id]/route.ts`
- Create: `src/app/api/members/me/route.ts`

- [ ] **Step 1: Create `src/app/api/members/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { NextResponse } from "next/server";

// GET — list members of the active account (owner-only)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx || !can(ctx.role, "MANAGE_MEMBERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const members = await prisma.accountMember.findMany({
    where: { accountId: ctx.accountId },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(members);
}
```

- [ ] **Step 2: Create `src/app/api/members/[id]/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { NextResponse } from "next/server";
import type { MemberRole } from "@/generated/prisma/client";

// PATCH — change role (owner-only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx || !can(ctx.role, "MANAGE_MEMBERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const role = body.role as MemberRole;
  if (role !== "VIEWER" && role !== "EDITOR") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const member = await prisma.accountMember.findUnique({ where: { id } });
  if (!member || member.accountId !== ctx.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.accountMember.update({ where: { id }, data: { role } });
  return NextResponse.json({ success: true });
}

// DELETE — remove a member (owner-only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx || !can(ctx.role, "MANAGE_MEMBERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const member = await prisma.accountMember.findUnique({ where: { id } });
  if (!member || member.accountId !== ctx.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.accountMember.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create `src/app/api/members/me/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

// DELETE — leave an account (the URL accepts ?accountId=...)
export async function DELETE(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const accountId = url.searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  // Cannot leave your own account
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (account.ownerId === session.user.id) {
    return NextResponse.json({ error: "Cannot leave your own account" }, { status: 400 });
  }

  await prisma.accountMember.deleteMany({
    where: { accountId, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/members/
git commit -m "feat: members API for list, role change, removal, leave"
```

---

### Task 12: Invite send API

**Files:**
- Create: `src/app/api/invites/route.ts`
- Modify: `src/lib/rate-limit.ts` (add a stronger rate limiter for invites)

- [ ] **Step 1: Add invite rate limiter to `src/lib/rate-limit.ts`**

Append to `src/lib/rate-limit.ts`:

```ts
// 10 invites per hour per owner
export const inviteSendLimiter = createRateLimiter(10, 60 * 60 * 1000);

// 20 invite-token lookups per hour per IP
export const inviteLookupLimiter = createRateLimiter(20, 60 * 60 * 1000);
```

- [ ] **Step 2: Create `src/app/api/invites/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { getPlanLimits } from "@/lib/plans";
import { sendInviteEmail } from "@/lib/email";
import { inviteSendLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import type { MemberRole } from "@/generated/prisma/client";

// GET — list pending invites for the active account (owner-only)
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx || !can(ctx.role, "MANAGE_MEMBERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await prisma.invite.findMany({
    where: { accountId: ctx.accountId, acceptedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(invites);
}

// POST — send a new invite
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx || !can(ctx.role, "MANAGE_MEMBERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (inviteSendLimiter(session.user.id)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const email = (body.email ?? "").toLowerCase().trim();
  const role = body.role as MemberRole;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (role !== "VIEWER" && role !== "EDITOR") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const account = await prisma.account.findUnique({
    where: { id: ctx.accountId },
    include: { owner: { select: { email: true, name: true } } },
  });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (account.owner.email.toLowerCase() === email) {
    return NextResponse.json({ error: "SELF_INVITE" }, { status: 400 });
  }

  // Already a member?
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMember = await prisma.accountMember.findUnique({
      where: { accountId_userId: { accountId: ctx.accountId, userId: existingUser.id } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "ALREADY_MEMBER" }, { status: 409 });
    }
  }

  // Existing pending invite?
  const existingInvite = await prisma.invite.findUnique({
    where: { accountId_email: { accountId: ctx.accountId, email } },
  });
  if (existingInvite && !existingInvite.acceptedAt && existingInvite.expiresAt > new Date()) {
    return NextResponse.json({ error: "INVITE_DUPLICATE" }, { status: 409 });
  }

  // Plan limit: members + pending invites
  const subscription = await prisma.subscription.findUnique({
    where: { userId: account.ownerId },
  });
  const limits = getPlanLimits(subscription?.plan);
  const memberCount = await prisma.accountMember.count({ where: { accountId: ctx.accountId } });
  const pendingInviteCount = await prisma.invite.count({
    where: { accountId: ctx.accountId, acceptedAt: null, expiresAt: { gt: new Date() } },
  });
  if (memberCount + pendingInviteCount >= limits.maxMembers) {
    return NextResponse.json({ error: "MEMBER_LIMIT_REACHED" }, { status: 403 });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Upsert: if a stale (expired/accepted) invite exists with this email, replace it.
  const invite = await prisma.invite.upsert({
    where: { accountId_email: { accountId: ctx.accountId, email } },
    update: { token, role, expiresAt, acceptedAt: null, invitedBy: session.user.id },
    create: {
      accountId: ctx.accountId,
      email,
      role,
      token,
      expiresAt,
      invitedBy: session.user.id,
    },
  });

  await sendInviteEmail({
    toEmail: email,
    accountName: account.name,
    inviterName: account.owner.name ?? account.owner.email,
    role,
    token,
  });

  return NextResponse.json(invite, { status: 201 });
}
```

- [ ] **Step 3: Type check (will fail until sendInviteEmail exists — see Task 15)**

```bash
npx tsc --noEmit
```

If errors point to `sendInviteEmail` not found, that's expected — the next task adds it. Continue.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/invites/route.ts src/lib/rate-limit.ts
git commit -m "feat: invite send and list API with rate limiting"
```

---

### Task 13: Invite revoke and resend API

**Files:**
- Create: `src/app/api/invites/[id]/route.ts`
- Create: `src/app/api/invites/[id]/resend/route.ts`

- [ ] **Step 1: Create `src/app/api/invites/[id]/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { NextResponse } from "next/server";

// DELETE — revoke a pending invite
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx || !can(ctx.role, "MANAGE_MEMBERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite || invite.accountId !== ctx.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.invite.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create `src/app/api/invites/[id]/resend/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAccount } from "@/lib/account-context";
import { can } from "@/lib/access";
import { sendInviteEmail } from "@/lib/email";
import { inviteSendLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

// POST — resend an existing invite. Refresh token + expiry if expired.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getActiveAccount(session.user.id);
  if (!ctx || !can(ctx.role, "MANAGE_MEMBERS")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (inviteSendLimiter(session.user.id)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const invite = await prisma.invite.findUnique({ where: { id } });
  if (!invite || invite.accountId !== ctx.accountId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "Already accepted" }, { status: 400 });
  }

  let token = invite.token;
  let expiresAt = invite.expiresAt;
  if (expiresAt < new Date()) {
    token = randomBytes(32).toString("base64url");
    expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.invite.update({
      where: { id },
      data: { token, expiresAt },
    });
  }

  const account = await prisma.account.findUnique({
    where: { id: ctx.accountId },
    include: { owner: { select: { email: true, name: true } } },
  });

  await sendInviteEmail({
    toEmail: invite.email,
    accountName: account!.name,
    inviterName: account!.owner.name ?? account!.owner.email,
    role: invite.role,
    token,
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invites/
git commit -m "feat: invite revoke and resend API"
```

---

### Task 14: Invite acceptance API

**Files:**
- Create: `src/app/api/invites/[token]/accept/route.ts`

Note: this collides with `[id]` — Next.js routes by segment shape, so we use a different segment name. Create a separate folder structure.

Actually, `/api/invites/[id]` and `/api/invites/[token]/accept` would conflict (both `[x]` at the same level). Resolve by nesting `accept` under a sub-route by token:

Use `/api/invites/accept/[token]/route.ts` instead.

- [ ] **Step 1: Create `src/app/api/invites/accept/[token]/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { setActiveAccountCookie } from "@/lib/account-context";
import { inviteLookupLimiter } from "@/lib/rate-limit";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

// GET — return invite details for the landing page
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (inviteLookupLimiter(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: {
      account: { include: { owner: { select: { name: true, email: true } } } },
    },
  });

  if (!invite) {
    return NextResponse.json({ error: "INVALID" }, { status: 404 });
  }
  if (invite.acceptedAt) {
    return NextResponse.json({ error: "ALREADY_ACCEPTED" }, { status: 410 });
  }
  if (invite.expiresAt < new Date()) {
    return NextResponse.json({ error: "EXPIRED" }, { status: 410 });
  }

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    accountName: invite.account.name,
    inviterName: invite.account.owner.name ?? invite.account.owner.email,
  });
}

// POST — accept the invite (must be logged in with matching email)
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const invite = await tx.invite.findUnique({ where: { token } });
    if (!invite) return { error: "INVALID" as const };
    if (invite.acceptedAt) return { error: "ALREADY_ACCEPTED" as const };
    if (invite.expiresAt < new Date()) return { error: "EXPIRED" as const };
    if (invite.email.toLowerCase() !== session.user!.email!.toLowerCase()) {
      return { error: "EMAIL_MISMATCH" as const, inviteEmail: invite.email };
    }

    // Idempotent membership
    const existing = await tx.accountMember.findUnique({
      where: { accountId_userId: { accountId: invite.accountId, userId: session.user!.id! } },
    });
    if (!existing) {
      await tx.accountMember.create({
        data: {
          accountId: invite.accountId,
          userId: session.user!.id!,
          role: invite.role,
        },
      });
    }
    await tx.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
    return { ok: true as const, accountId: invite.accountId };
  });

  if ("error" in result) {
    const status = result.error === "EMAIL_MISMATCH" ? 403 : 410;
    return NextResponse.json(result, { status });
  }

  await setActiveAccountCookie(result.accountId);
  return NextResponse.json({ success: true, accountId: result.accountId });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/invites/accept/
git commit -m "feat: invite accept API with email match and transaction"
```

---

### Task 15: Add invite email template

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: Append `sendInviteEmail` to `src/lib/email.ts`**

Add to the bottom of `src/lib/email.ts`:

```ts
export async function sendInviteEmail(opts: {
  toEmail: string;
  accountName: string;
  inviterName: string;
  role: "VIEWER" | "EDITOR";
  token: string;
}) {
  const { toEmail, accountName, inviterName, role, token } = opts;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteLinkEn = `${appUrl}/en/invite/${token}`;
  const inviteLinkFr = `${appUrl}/fr/invite/${token}`;
  const safeAccount = escapeHtml(accountName);
  const safeInviter = escapeHtml(inviterName);
  const roleEn = role === "EDITOR" ? "Editor" : "Viewer";
  const roleFr = role === "EDITOR" ? "Éditeur" : "Lecteur";

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: {
            Data: `${inviterName} invited you to ${accountName} on Stelld / ${inviterName} vous a invité sur Stelld`,
          },
          Body: {
            Html: {
              Data: `
                <p><strong>${safeInviter}</strong> has invited you to join <strong>${safeAccount}</strong> on Stelld as a <strong>${roleEn}</strong>.</p>
                <p><a href="${inviteLinkEn}">Accept invitation</a></p>
                <p style="color:#666;font-size:12px;">This invite expires in 7 days. If you weren't expecting this, you can ignore this email.</p>
                <hr style="margin: 24px 0; border: none; border-top: 1px solid #e5e7eb;" />
                <p><strong>${safeInviter}</strong> vous a invité à rejoindre <strong>${safeAccount}</strong> sur Stelld en tant que <strong>${roleFr}</strong>.</p>
                <p><a href="${inviteLinkFr}">Accepter l'invitation</a></p>
                <p style="color:#666;font-size:12px;">Cette invitation expire dans 7 jours. Si vous n'attendiez pas cette invitation, vous pouvez ignorer ce courriel.</p>
              `,
            },
            Text: {
              Data: `${inviterName} invited you to join ${accountName} on Stelld as a ${roleEn}.\n\nAccept: ${inviteLinkEn}\n\nThis invite expires in 7 days.\n\n---\n\n${inviterName} vous a invité à rejoindre ${accountName} sur Stelld en tant que ${roleFr}.\n\nAccepter : ${inviteLinkFr}\n\nCette invitation expire dans 7 jours.`,
            },
          },
        },
      })
    );
  } catch (error) {
    console.error("Failed to send invite email:", error);
  }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```

Expected: previous `sendInviteEmail` import errors from Task 12 now resolve.

- [ ] **Step 3: Commit**

```bash
git add src/lib/email.ts
git commit -m "feat: bilingual invite email template"
```

---

## Phase 4: Public Invite Landing Page & Auth Integration

### Task 16: Create /invite/[token] landing page

**Files:**
- Create: `src/app/[locale]/invite/[token]/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { Link, useRouter } from "@/i18n/routing";

interface InviteInfo {
  email: string;
  role: "VIEWER" | "EDITOR";
  accountName: string;
  inviterName: string;
}

type State =
  | { status: "loading" }
  | { status: "ok"; invite: InviteInfo }
  | { status: "error"; code: "INVALID" | "EXPIRED" | "ALREADY_ACCEPTED" | "EMAIL_MISMATCH" | "NETWORK"; inviteEmail?: string };

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const t = useTranslations("members");
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    fetch(`/api/invites/accept/${token}`)
      .then(async (r) => {
        if (r.ok) {
          const invite = (await r.json()) as InviteInfo;
          setState({ status: "ok", invite });
        } else {
          const body = await r.json().catch(() => ({}));
          setState({ status: "error", code: body.error ?? "INVALID" });
        }
      })
      .catch(() => setState({ status: "error", code: "NETWORK" }));
  }, [token]);

  async function accept() {
    setAccepting(true);
    const r = await fetch(`/api/invites/accept/${token}`, { method: "POST" });
    if (r.ok) {
      router.push("/dashboard");
    } else {
      const body = await r.json().catch(() => ({}));
      setState({ status: "error", code: body.error ?? "INVALID", inviteEmail: body.inviteEmail });
      setAccepting(false);
    }
  }

  if (state.status === "loading" || sessionStatus === "loading") {
    return <div className="max-w-md mx-auto py-16 text-center text-gray-600">{t("loadingInvite")}</div>;
  }

  if (state.status === "error") {
    const messages: Record<string, string> = {
      INVALID: t("inviteInvalid"),
      EXPIRED: t("inviteExpired"),
      ALREADY_ACCEPTED: t("inviteAlreadyAccepted"),
      EMAIL_MISMATCH: t("inviteEmailMismatch", { email: state.inviteEmail ?? "" }),
      NETWORK: t("inviteNetworkError"),
    };
    return (
      <div className="max-w-md mx-auto py-16 text-center">
        <h1 className="text-2xl font-bold mb-4">{t("inviteUnavailable")}</h1>
        <p className="text-gray-700 mb-6">{messages[state.code] ?? messages.INVALID}</p>
        <Link href="/login" className="text-green-600 hover:underline">{t("goToLogin")}</Link>
      </div>
    );
  }

  const { invite } = state;
  const isLoggedIn = sessionStatus === "authenticated";
  const matchEmail = isLoggedIn && session?.user?.email?.toLowerCase() === invite.email.toLowerCase();

  return (
    <div className="max-w-md mx-auto py-16 px-4">
      <h1 className="text-2xl font-bold mb-2">{t("youveBeenInvited")}</h1>
      <p className="text-gray-700 mb-6">
        {t("inviteMessage", {
          inviter: invite.inviterName,
          account: invite.accountName,
          role: invite.role === "EDITOR" ? t("roleEditor") : t("roleViewer"),
        })}
      </p>

      {isLoggedIn && matchEmail && (
        <button
          onClick={accept}
          disabled={accepting}
          className="w-full bg-black text-white font-medium py-2.5 rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {accepting ? t("accepting") : t("accept")}
        </button>
      )}

      {isLoggedIn && !matchEmail && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-md text-sm text-yellow-900">
          {t("emailMismatchWarning", { email: invite.email })}
        </div>
      )}

      {!isLoggedIn && (
        <div className="space-y-3">
          <Link
            href={{ pathname: "/login", query: { invite: token } }}
            className="block w-full bg-black text-white font-medium py-2.5 rounded-md text-center hover:bg-gray-800"
          >
            {t("logInToAccept")}
          </Link>
          <Link
            href={{ pathname: "/signup", query: { invite: token, email: invite.email } }}
            className="block w-full border border-gray-300 text-gray-900 font-medium py-2.5 rounded-md text-center hover:bg-gray-50"
          >
            {t("signUpToAccept")}
          </Link>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wrap the page in a SessionProvider if not already**

Check whether the root layout (or `[locale]/layout.tsx`) wraps with `SessionProvider`. If not, the `useSession` hook will fail. Read:

```bash
grep -rn "SessionProvider" src/app
```

If absent, add a client `Providers` component and wrap `[locale]/layout.tsx`:

Create `src/components/providers.tsx`:

```tsx
"use client";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
```

Then in `src/app/[locale]/layout.tsx`, wrap `{children}` with `<Providers>{children}</Providers>`.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/invite/ src/components/providers.tsx src/app/[locale]/layout.tsx
git commit -m "feat: invite landing page with login/signup paths"
```

---

### Task 17: Preserve invite token through login and signup flows

**Files:**
- Modify: `src/app/[locale]/(auth)/login/page.tsx`
- Modify: `src/app/[locale]/(auth)/signup/page.tsx`
- Modify: `src/app/api/auth/signup/route.ts`

After login or signup, redirect to `/invite/<token>` if the URL had `?invite=<token>`.

- [ ] **Step 1: Read both pages**

```bash
cat src/app/[locale]/\(auth\)/login/page.tsx
cat src/app/[locale]/\(auth\)/signup/page.tsx
```

- [ ] **Step 2: In `login/page.tsx`**

After successful login, change the redirect target:

```ts
const params = useSearchParams();
const inviteToken = params.get("invite");
// ...
// after successful signIn:
router.push(inviteToken ? `/invite/${inviteToken}` : "/dashboard");
```

If using server-side `signIn` form action, pass `redirectTo` accordingly:

```ts
await signIn("credentials", {
  email, password,
  redirectTo: inviteToken ? `/${locale}/invite/${inviteToken}` : `/${locale}/dashboard`,
});
```

Same pattern for the Google button.

- [ ] **Step 3: In `signup/page.tsx`**

Pre-fill the email field if `?email=<email>` is present (read-only or editable — your call; recommend read-only when invite token is also present, so they can't sign up with a different email).

After successful signup, redirect to `/invite/<token>` if `inviteToken` exists, otherwise to `/login`.

- [ ] **Step 4: In `src/app/api/auth/signup/route.ts`**

The signup endpoint just creates the user. After this task it doesn't need to change. The invite acceptance happens after they log in and land on the invite page.

- [ ] **Step 5: Manually verify**

Send yourself an invite (you can manually create one via Prisma Studio for testing, or wait until Task 20). Click the link → log in → confirm redirect lands on `/invite/<token>` → confirm "Accept" button works.

- [ ] **Step 6: Commit**

```bash
git add src/app/[locale]/\(auth\)/
git commit -m "feat: preserve invite token through login and signup flows"
```

---

## Phase 5: UI — Account Switcher & Members Page

### Task 18: Build account switcher component

**Files:**
- Create: `src/components/account-switcher.tsx`
- Create: `src/app/api/accounts/route.ts`

The switcher needs a list of accounts the current user can access. Add a small API endpoint for that.

- [ ] **Step 1: Create `src/app/api/accounts/route.ts`**

```ts
import { auth } from "@/lib/auth";
import { listAccessibleAccounts } from "@/lib/access";
import { getActiveAccount } from "@/lib/account-context";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await listAccessibleAccounts(session.user.id);
  const ctx = await getActiveAccount(session.user.id);

  return NextResponse.json({
    accounts: accounts.map((a) => ({
      id: a.account.id,
      name: a.account.name,
      role: a.role,
    })),
    activeAccountId: ctx?.accountId ?? null,
  });
}
```

- [ ] **Step 2: Add a server action for switching accounts**

Create `src/app/api/accounts/switch/route.ts`:

```ts
import { auth } from "@/lib/auth";
import { getAccountAccess } from "@/lib/access";
import { setActiveAccountCookie } from "@/lib/account-context";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId } = await req.json();
  if (!accountId) {
    return NextResponse.json({ error: "accountId required" }, { status: 400 });
  }

  const role = await getAccountAccess(session.user.id, accountId);
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await setActiveAccountCookie(accountId);
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Create `src/components/account-switcher.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/routing";
import { useTranslations } from "next-intl";

interface AccountOption {
  id: string;
  name: string;
  role: "OWNER" | "EDITOR" | "VIEWER";
}

export function AccountSwitcher() {
  const t = useTranslations("members");
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((data) => {
        setAccounts(data.accounts);
        setActiveId(data.activeAccountId);
      });
  }, []);

  async function switchTo(id: string) {
    if (id === activeId) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    await fetch("/api/accounts/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId: id }),
    });
    router.refresh();
    setOpen(false);
    setSwitching(false);
  }

  if (accounts.length === 0) return null;
  if (accounts.length === 1) {
    return <span className="text-sm font-medium text-gray-700">{accounts[0].name}</span>;
  }

  const active = accounts.find((a) => a.id === activeId) ?? accounts[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-sm font-medium text-gray-700 hover:text-gray-900 flex items-center gap-1"
      >
        {active.name}
        <span className="text-gray-400">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50">
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => switchTo(a.id)}
              disabled={switching}
              className={`block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 ${a.id === activeId ? "bg-gray-50 font-medium" : ""}`}
            >
              <div>{a.name}</div>
              {a.role !== "OWNER" && (
                <div className="text-xs text-gray-500">
                  {a.role === "EDITOR" ? t("roleEditor") : t("roleViewer")}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/accounts/ src/components/account-switcher.tsx
git commit -m "feat: account switcher component and accounts API"
```

---

### Task 19: Insert switcher into dashboard layout

**Files:**
- Modify: `src/app/[locale]/(dashboard)/layout.tsx`

- [ ] **Step 1: Update layout**

Replace the contents to insert `AccountSwitcher` and pass the active context to children via a client-readable signal (we'll just use the cookie directly in components that need it).

```tsx
import { auth } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { Link, redirect } from "@/i18n/routing";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AccountSwitcher } from "@/components/account-switcher";
import { Footer } from "@/components/footer";
import { getActiveAccount } from "@/lib/account-context";

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect({ href: "/login", locale: locale as "en" | "fr" });

  const ctx = await getActiveAccount(session!.user!.id!);

  const t = await getTranslations("nav");
  const tb = await getTranslations("billing");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-xl text-gray-900">Stelld</Link>
        <div className="flex items-center gap-5">
          <AccountSwitcher />
          {ctx?.role === "OWNER" && (
            <>
              <Link href="/dashboard/members" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                {t("members")}
              </Link>
              <Link href="/dashboard/billing" className="text-sm font-medium text-gray-600 hover:text-gray-900">
                {tb("title")}
              </Link>
            </>
          )}
          <LanguageSwitcher />
          <span className="text-sm font-medium text-gray-700">{session!.user!.email}</span>
          <form action={async () => {
            "use server";
            const { signOut } = await import("@/lib/auth");
            await signOut({ redirectTo: `/${locale}/login` });
          }}>
            <button type="submit" className="text-sm font-medium text-gray-500 hover:text-gray-900">
              {t("logOut")}
            </button>
          </form>
        </div>
      </nav>
      <main className="flex-1 max-w-6xl mx-auto p-8 w-full">{children}</main>
      <Footer />
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

Reload `/dashboard`. Confirm header shows your account name (only one for now). Confirm "Members" link visible (since you're owner of your personal account). Click — will 404 until Task 20.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/\(dashboard\)/layout.tsx
git commit -m "feat: account switcher and members link in dashboard nav"
```

---

### Task 20: Build members management page

**Files:**
- Create: `src/app/[locale]/(dashboard)/dashboard/members/page.tsx`
- Create: `src/components/members-page.tsx`

The page shell is a server component that gates owner-only access; the body is a client component for interactivity.

- [ ] **Step 1: Create the server-component shell**

`src/app/[locale]/(dashboard)/dashboard/members/page.tsx`:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { getActiveAccount } from "@/lib/account-context";
import { getPlanLimits } from "@/lib/plans";
import { prisma } from "@/lib/db";
import { MembersPage } from "@/components/members-page";

export default async function MembersRoutePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale: locale as "en" | "fr" });

  const ctx = await getActiveAccount(session!.user!.id!);
  if (!ctx || ctx.role !== "OWNER") {
    redirect({ href: "/dashboard", locale: locale as "en" | "fr" });
  }

  const account = await prisma.account.findUnique({ where: { id: ctx!.accountId } });
  const subscription = await prisma.subscription.findUnique({
    where: { userId: account!.ownerId },
  });
  const limits = getPlanLimits(subscription?.plan);

  return <MembersPage accountName={account!.name} maxMembers={limits.maxMembers} />;
}
```

- [ ] **Step 2: Create `src/components/members-page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

interface Member {
  id: string;
  role: "VIEWER" | "EDITOR";
  user: { id: string; name: string | null; email: string; image: string | null };
}

interface Invite {
  id: string;
  email: string;
  role: "VIEWER" | "EDITOR";
  expiresAt: string;
  createdAt: string;
}

export function MembersPage({
  accountName,
  maxMembers,
}: {
  accountName: string;
  maxMembers: number;
}) {
  const t = useTranslations("members");
  const tc = useTranslations("common");

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"VIEWER" | "EDITOR">("EDITOR");
  const [inviteError, setInviteError] = useState("");
  const [inviting, setInviting] = useState(false);

  async function refresh() {
    setLoading(true);
    const [m, i] = await Promise.all([
      fetch("/api/members").then((r) => r.json()),
      fetch("/api/invites").then((r) => r.json()),
    ]);
    setMembers(m);
    setInvites(i);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function sendInvite() {
    setInviteError("");
    setInviting(true);
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    });
    setInviting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg: Record<string, string> = {
        MEMBER_LIMIT_REACHED: t("memberLimitReached", { max: maxMembers }),
        INVITE_DUPLICATE: t("inviteDuplicate"),
        SELF_INVITE: t("selfInvite"),
        ALREADY_MEMBER: t("alreadyMember"),
      };
      setInviteError(msg[body.error] ?? tc("error"));
      return;
    }
    setInviteEmail("");
    setShowInvite(false);
    refresh();
  }

  async function changeRole(memberId: string, role: "VIEWER" | "EDITOR") {
    await fetch(`/api/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    refresh();
  }

  async function removeMember(memberId: string) {
    if (!confirm(t("removeConfirm"))) return;
    await fetch(`/api/members/${memberId}`, { method: "DELETE" });
    refresh();
  }

  async function revokeInvite(id: string) {
    if (!confirm(t("revokeConfirm"))) return;
    await fetch(`/api/invites/${id}`, { method: "DELETE" });
    refresh();
  }

  async function resendInvite(id: string) {
    await fetch(`/api/invites/${id}/resend`, { method: "POST" });
    alert(t("inviteResent"));
  }

  const usedSlots = members.length + invites.length;
  const atLimit = usedSlots >= maxMembers;

  if (loading) return <div className="text-gray-600">{tc("loading")}</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{t("title")}</h1>
      <p className="text-gray-500 mb-8">{t("subtitle", { account: accountName })}</p>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{t("membersHeading")}</h2>
        <button
          onClick={() => setShowInvite(true)}
          disabled={atLimit}
          className="bg-black text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
        >
          {atLimit
            ? t("atLimit", { used: usedSlots, max: maxMembers })
            : t("inviteButton")}
        </button>
      </div>

      {showInvite && (
        <div className="border border-gray-200 rounded-md p-4 mb-6 bg-gray-50">
          <h3 className="font-medium mb-3">{t("inviteHeading")}</h3>
          <div className="flex gap-2 mb-3">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder={t("emailPlaceholder")}
              className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as "VIEWER" | "EDITOR")}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="EDITOR">{t("roleEditor")}</option>
              <option value="VIEWER">{t("roleViewer")}</option>
            </select>
          </div>
          {inviteError && <p className="text-red-600 text-sm mb-2">{inviteError}</p>}
          <div className="flex gap-2">
            <button
              onClick={sendInvite}
              disabled={inviting || !inviteEmail}
              className="bg-black text-white text-sm px-4 py-2 rounded-md hover:bg-gray-800 disabled:opacity-50"
            >
              {inviting ? t("sending") : t("send")}
            </button>
            <button
              onClick={() => { setShowInvite(false); setInviteError(""); }}
              className="text-sm text-gray-700 px-4 py-2"
            >
              {tc("cancel")}
            </button>
          </div>
        </div>
      )}

      {members.length === 0 ? (
        <p className="text-gray-500 mb-8 text-sm">{t("noMembers")}</p>
      ) : (
        <table className="w-full mb-8">
          <thead className="text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="py-2">{t("colUser")}</th>
              <th className="py-2">{t("colRole")}</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-gray-100">
                <td className="py-3">
                  <div className="font-medium text-sm">{m.user.name ?? m.user.email}</div>
                  <div className="text-xs text-gray-500">{m.user.email}</div>
                </td>
                <td className="py-3">
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.id, e.target.value as "VIEWER" | "EDITOR")}
                    className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                  >
                    <option value="EDITOR">{t("roleEditor")}</option>
                    <option value="VIEWER">{t("roleViewer")}</option>
                  </select>
                </td>
                <td className="py-3 text-right">
                  <button
                    onClick={() => removeMember(m.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    {t("remove")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {invites.length > 0 && (
        <>
          <h2 className="text-xl font-semibold mb-4">{t("pendingInvitesHeading")}</h2>
          <table className="w-full">
            <thead className="text-left text-xs text-gray-500 uppercase">
              <tr>
                <th className="py-2">{t("colEmail")}</th>
                <th className="py-2">{t("colRole")}</th>
                <th className="py-2">{t("colExpires")}</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((i) => (
                <tr key={i.id} className="border-t border-gray-100">
                  <td className="py-3 text-sm">{i.email}</td>
                  <td className="py-3 text-sm">
                    {i.role === "EDITOR" ? t("roleEditor") : t("roleViewer")}
                  </td>
                  <td className="py-3 text-sm text-gray-500">
                    {new Date(i.expiresAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-right space-x-3">
                    <button onClick={() => resendInvite(i.id)} className="text-sm text-blue-600 hover:underline">
                      {t("resend")}
                    </button>
                    <button onClick={() => revokeInvite(i.id)} className="text-sm text-red-600 hover:underline">
                      {t("revoke")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Manually verify**

Navigate to `/dashboard/members`. Confirm: page loads, "Invite member" button appears, clicking it opens the form. Send a real invite to a secondary email you own. Check email arrives. Click the link → land on the invite page. Sign up or log in. Verify membership row appears in the members table on refresh.

- [ ] **Step 3: Commit**

```bash
git add src/app/[locale]/\(dashboard\)/dashboard/members/ src/components/members-page.tsx
git commit -m "feat: members management page with invite, role change, removal"
```

---

### Task 21: Update dashboard for role-based UI

**Files:**
- Modify: `src/app/[locale]/(dashboard)/dashboard/page.tsx`
- Modify: `src/app/api/forms/route.ts` (already returns role implicitly via data; expose explicitly)

The dashboard needs to know the active role to hide/show "+ New Form," delete buttons on form cards, etc.

- [ ] **Step 1: Expose role in `/api/forms` response**

Update `src/app/api/forms/route.ts` to include the role at the top level:

In the GET handler, replace `return NextResponse.json(forms);` with:

```ts
return NextResponse.json({ forms, role: ctx.role });
```

- [ ] **Step 2: Update the dashboard page**

In `src/app/[locale]/(dashboard)/dashboard/page.tsx`, change the fetch:

```ts
const [role, setRole] = useState<"OWNER" | "EDITOR" | "VIEWER" | null>(null);

async function fetchForms() {
  try {
    const res = await fetch("/api/forms");
    const data = await res.json();
    setForms(data.forms);
    setRole(data.role);
  } catch {
    setError(tc("error"));
  } finally {
    setLoading(false);
  }
}
```

Hide the "+ New Form" button when `role === "VIEWER"`:

```tsx
{role !== "VIEWER" && (
  <button onClick={createForm} disabled={creating} ...>
    {creating ? t("creating") : t("newForm")}
  </button>
)}
```

In `<FormCard>`, hide `onDelete` when role isn't OWNER and `onDuplicate` when role is VIEWER:

Update `<FormCard>` props to accept `canDelete` / `canDuplicate` flags, and use them in the card body to render or hide buttons. Quick approach: pass `onDelete={role === "OWNER" ? deleteForm : undefined}` etc. — the FormCard should already conditionally render based on whether the prop is provided.

If `FormCard` doesn't already conditionally render, modify it to:

```tsx
{onDelete && (
  <button onClick={() => onDelete(id)}>{t("delete")}</button>
)}
{onDuplicate && (
  <button onClick={() => onDuplicate(id)}>{t("duplicate")}</button>
)}
```

- [ ] **Step 3: Manually verify**

Switch into an account where you're a VIEWER (will require accepting an invite first; if you haven't yet, skip this verification — it'll happen during the end-to-end check in Task 25). For now, just confirm OWNER view (your own account) still shows all controls.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/forms/route.ts src/app/[locale]/\(dashboard\)/dashboard/page.tsx src/components/form-card.tsx
git commit -m "feat: role-based UI on dashboard"
```

---

### Task 22: Form builder read-only mode for viewers

**Files:**
- Modify: `src/components/form-builder.tsx`
- Modify: `src/app/[locale]/builder/[id]/page.tsx`

The builder needs to know the user's role for the form's account.

- [ ] **Step 1: Read the builder page**

```bash
cat src/app/[locale]/builder/[id]/page.tsx
```

- [ ] **Step 2: Resolve role server-side and pass to builder**

In `src/app/[locale]/builder/[id]/page.tsx`, replace the form-load logic to use `getFormAccess`:

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "@/i18n/routing";
import { getFormAccess } from "@/lib/access";
// existing imports...

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect({ href: "/login", locale: locale as "en" | "fr" });

  const access = await getFormAccess(session!.user!.id!, id);
  if (!access) {
    return <div className="p-8 text-center text-gray-500">{/* not-found message */}</div>;
  }

  return <FormBuilder formId={id} initialForm={access.form} role={access.role} />;
}
```

(Adapt to whatever the existing component signature is — the gist: pass `role` down.)

- [ ] **Step 3: Update FormBuilder to accept and respect role**

In `src/components/form-builder.tsx`:

- Accept `role: "OWNER" | "EDITOR" | "VIEWER"` prop.
- If `role === "VIEWER"`:
  - Disable autosave (don't fire PUT).
  - Disable all field-edit interactions (read-only inputs).
  - Hide "Save," "Publish," "Add field," "Reorder."
  - Show a `Read-only` badge in the toolbar.
- Hide the "Delete form" button for non-owners.
- Respect existing edit logic for OWNER and EDITOR.

The exact code edits depend on the current builder structure. The pattern:

```tsx
const isReadOnly = role === "VIEWER";

// when handling field changes:
if (isReadOnly) return;

// when rendering buttons:
{!isReadOnly && <button>Add field</button>}

// at top of builder:
{isReadOnly && (
  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
    {t("readOnlyBadge")}
  </span>
)}

// delete button:
{role === "OWNER" && <button>Delete</button>}
```

- [ ] **Step 4: Manually verify**

As OWNER on your own account, confirm builder still works as before. (Cross-role verification happens in Task 25.)

- [ ] **Step 5: Commit**

```bash
git add src/components/form-builder.tsx src/app/[locale]/builder/[id]/page.tsx
git commit -m "feat: read-only form builder for viewers"
```

---

### Task 23: Update form detail/submissions UI for role-based controls

**Files:**
- Modify: `src/app/[locale]/(dashboard)/dashboard/forms/[id]/page.tsx`

- [ ] **Step 1: Read the file**

```bash
cat "src/app/[locale]/(dashboard)/dashboard/forms/[id]/page.tsx"
```

- [ ] **Step 2: Resolve role and gate destructive actions**

If the page is a server component, do `const access = await getFormAccess(session.user.id, id);` and pass `role` to the submissions table component (or whatever child renders rows).

If it's a client component, fetch `/api/forms/<id>` (already returns `_role` after Task 7) and gate by it:

- Hide "Delete submission" buttons unless `_role === "OWNER"`.
- Show CSV export for all roles.

- [ ] **Step 3: Commit**

```bash
git add "src/app/[locale]/(dashboard)/dashboard/forms/[id]/page.tsx"
git commit -m "feat: role-based controls on form submissions page"
```

---

### Task 24: Add i18n strings

**Files:**
- Modify: `messages/en.json`
- Modify: `messages/fr.json`

- [ ] **Step 1: Add `members` namespace to `messages/en.json`**

Insert before the closing `}` of the JSON object:

```json
"members": {
  "title": "Members",
  "subtitle": "Manage who can access {account}.",
  "membersHeading": "Members",
  "pendingInvitesHeading": "Pending invites",
  "inviteButton": "+ Invite member",
  "atLimit": "At limit ({used}/{max})",
  "inviteHeading": "Invite a new member",
  "emailPlaceholder": "name@example.com",
  "send": "Send invite",
  "sending": "Sending...",
  "roleEditor": "Editor",
  "roleViewer": "Viewer",
  "remove": "Remove",
  "removeConfirm": "Remove this member from your account?",
  "revoke": "Revoke",
  "revokeConfirm": "Revoke this pending invite?",
  "resend": "Resend",
  "inviteResent": "Invite resent.",
  "noMembers": "No members yet. Invite someone to get started.",
  "colUser": "User",
  "colRole": "Role",
  "colEmail": "Email",
  "colExpires": "Expires",
  "memberLimitReached": "Your plan allows up to {max} members. Upgrade for more.",
  "inviteDuplicate": "An invite is already pending for this email.",
  "selfInvite": "You can't invite yourself.",
  "alreadyMember": "This person is already a member.",
  "youveBeenInvited": "You've been invited",
  "inviteMessage": "{inviter} invited you to join {account} as a {role}.",
  "logInToAccept": "Log in to accept",
  "signUpToAccept": "Create account to accept",
  "accept": "Accept invitation",
  "accepting": "Accepting...",
  "loadingInvite": "Loading invitation...",
  "inviteUnavailable": "Invitation unavailable",
  "inviteInvalid": "This invitation is invalid.",
  "inviteExpired": "This invitation has expired. Ask the owner to send a new one.",
  "inviteAlreadyAccepted": "This invitation has already been used.",
  "inviteEmailMismatch": "This invite was sent to {email}. Please log in with that email.",
  "inviteNetworkError": "We couldn't load the invitation. Please try again.",
  "emailMismatchWarning": "You're logged in with a different email than this invite was sent to ({email}). Log out and log in with that email to accept.",
  "goToLogin": "Go to login",
  "readOnlyBadge": "Read-only"
}
```

Also add to the existing `nav` namespace: `"members": "Members"`.

- [ ] **Step 2: Add to `messages/fr.json`**

Translate each key. Suggested French strings:

```json
"members": {
  "title": "Membres",
  "subtitle": "Gérez qui peut accéder à {account}.",
  "membersHeading": "Membres",
  "pendingInvitesHeading": "Invitations en attente",
  "inviteButton": "+ Inviter un membre",
  "atLimit": "Limite atteinte ({used}/{max})",
  "inviteHeading": "Inviter un nouveau membre",
  "emailPlaceholder": "nom@exemple.com",
  "send": "Envoyer l'invitation",
  "sending": "Envoi...",
  "roleEditor": "Éditeur",
  "roleViewer": "Lecteur",
  "remove": "Retirer",
  "removeConfirm": "Retirer ce membre de votre compte ?",
  "revoke": "Annuler",
  "revokeConfirm": "Annuler cette invitation en attente ?",
  "resend": "Renvoyer",
  "inviteResent": "Invitation renvoyée.",
  "noMembers": "Aucun membre. Invitez quelqu'un pour commencer.",
  "colUser": "Utilisateur",
  "colRole": "Rôle",
  "colEmail": "Courriel",
  "colExpires": "Expire",
  "memberLimitReached": "Votre forfait permet jusqu'à {max} membres. Passez à un forfait supérieur pour en ajouter plus.",
  "inviteDuplicate": "Une invitation est déjà en attente pour ce courriel.",
  "selfInvite": "Vous ne pouvez pas vous inviter vous-même.",
  "alreadyMember": "Cette personne est déjà membre.",
  "youveBeenInvited": "Vous avez été invité",
  "inviteMessage": "{inviter} vous a invité à rejoindre {account} en tant que {role}.",
  "logInToAccept": "Se connecter pour accepter",
  "signUpToAccept": "Créer un compte pour accepter",
  "accept": "Accepter l'invitation",
  "accepting": "Acceptation...",
  "loadingInvite": "Chargement de l'invitation...",
  "inviteUnavailable": "Invitation indisponible",
  "inviteInvalid": "Cette invitation n'est pas valide.",
  "inviteExpired": "Cette invitation a expiré. Demandez au propriétaire d'en envoyer une nouvelle.",
  "inviteAlreadyAccepted": "Cette invitation a déjà été utilisée.",
  "inviteEmailMismatch": "Cette invitation a été envoyée à {email}. Veuillez vous connecter avec ce courriel.",
  "inviteNetworkError": "Nous n'avons pas pu charger l'invitation. Veuillez réessayer.",
  "emailMismatchWarning": "Vous êtes connecté avec un courriel différent de celui auquel cette invitation a été envoyée ({email}). Déconnectez-vous et reconnectez-vous avec ce courriel pour accepter.",
  "goToLogin": "Aller à la connexion",
  "readOnlyBadge": "Lecture seule"
}
```

Also add to the existing `nav` namespace in fr: `"members": "Membres"`.

- [ ] **Step 3: Manually verify**

Reload `/dashboard/members` in EN and FR locales (`/en/...` and `/fr/...`). Confirm strings render correctly.

- [ ] **Step 4: Commit**

```bash
git add messages/
git commit -m "i18n: add members namespace strings (EN + FR)"
```

---

## Phase 6: End-to-End Verification

### Task 25: Manual end-to-end verification

This is a checklist run, not a code change. Walk through every scenario from the spec.

- [ ] **Step 1: Set up two test users**

Use your existing main account as **Owner**. Use a secondary email (like a Gmail+alias or a test account) for **Member**.

- [ ] **Step 2: Owner invites Editor**

1. Log in as Owner.
2. Navigate to `/dashboard/members`.
3. Click "Invite member," enter Member email, select "Editor."
4. Confirm a row appears in Pending Invites.
5. Confirm invite email arrives at Member email.

- [ ] **Step 3: Member signs up via invite**

1. Open invite link in incognito.
2. Confirm landing page shows "You've been invited to join *Account Name* as Editor."
3. Click "Create account."
4. Email field should be pre-filled.
5. Complete signup.
6. After auth, should land on `/invite/<token>` with "Accept" button.
7. Click Accept. Should redirect to `/dashboard`.
8. Confirm Member sees Owner's forms in dashboard.

- [ ] **Step 4: Editor capabilities**

As Member (now Editor):
1. Confirm "+ New Form" button is visible.
2. Click it; create a form. Confirm it appears in the list.
3. Edit the form in the builder; confirm autosave works.
4. Confirm "Delete form" is not available on form cards.
5. Confirm submissions exports to CSV.

- [ ] **Step 5: Owner sees editor's form**

Switch back to Owner browser session. Refresh `/dashboard`. Confirm the form Editor created appears.

- [ ] **Step 6: Demote to Viewer**

As Owner: in `/dashboard/members`, change Member's role to Viewer.

As Member: refresh `/dashboard`.
1. Confirm "+ New Form" button is gone.
2. Open a form in the builder. Confirm "Read-only" badge, all inputs disabled.
3. Confirm submissions can still be viewed and exported.

- [ ] **Step 7: Account switcher**

As Member, confirm the header shows an account switcher with two entries: their own personal account and the Owner's account. Switch between them; confirm forms list and dashboard refresh appropriately.

- [ ] **Step 8: Plan limits — invite cap**

As FREE-tier Owner (only allows 1 member): try to invite a second person. Should show "MEMBER_LIMIT_REACHED" / "At limit" prompt.

(If your test owner is on PRO, you'd test by reaching the PRO limit of 5; or temporarily downgrade in DB for the test.)

- [ ] **Step 9: Invite revoke**

Owner sends a fresh invite to a third email. Then click "Revoke" before it's accepted. Open the email link → should show "expired/invalid."

- [ ] **Step 10: Email mismatch**

Owner sends invite to email X. As a logged-in user with email Y, click the link. Confirm landing page blocks acceptance with the "wrong email" message.

- [ ] **Step 11: Idempotent acceptance**

Click the accept button twice in rapid succession (or open two tabs and click both). Verify only one `AccountMember` row exists in the DB:

```bash
psql $DATABASE_URL -c "SELECT \"accountId\", \"userId\", COUNT(*) FROM account_members GROUP BY 1,2 HAVING COUNT(*) > 1;"
```

Expected: zero rows.

- [ ] **Step 12: Member removal**

Owner removes the Member from `/dashboard/members`. Member refreshes — confirm the Owner's account disappears from their account switcher and they land on their personal account.

- [ ] **Step 13: Member leaves**

Owner re-invites. Member accepts. Then Member opens their settings (if a member-side "leave" UI exists; otherwise call the API directly via fetch from devtools):

```js
fetch("/api/members/me?accountId=<owner-account-id>", { method: "DELETE" }).then(r => r.json())
```

Confirm Member loses access; Owner sees member count decrement.

- [ ] **Step 14: Mark verified**

If all of the above pass, this task is complete. If anything fails, file the bug as a follow-up commit (don't proceed until the failure is fixed).

- [ ] **Step 15: Commit verification log**

No code change. Skip commit.

---

### Task 26: Update docs and CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Add team collaboration to project status**

In `CLAUDE.md`, under "Feature Roadmap" → Phase 3, append:

```
- Team collaboration (Account/Member model, Viewer/Editor roles, email invites, account switcher) — **complete**
```

In "Project Status," append "team collaboration complete" to the list of shipped features.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: mark team collaboration complete in CLAUDE.md"
```

---

## Self-Review Notes

**Spec coverage:**
- Account model (hybrid, multi) → Tasks 1, 2, 4, 5
- Permissions matrix → Task 4 (PERMISSIONS map matches the matrix exactly)
- Plan limits including maxMembers → Task 3
- Schema with backfill → Tasks 1, 2
- Access control helper → Task 4
- Active account cookie → Task 5
- API refactor → Tasks 6, 7, 8, 9, 10
- Members API → Task 11
- Invite send/list/revoke/resend → Tasks 12, 13
- Invite accept (with email match + transaction) → Task 14
- Invite email → Task 15
- Public invite landing page → Task 16
- Login/signup token preservation → Task 17
- Account switcher → Tasks 18, 19
- Members management UI → Task 20
- Role-based dashboard UI → Task 21
- Builder read-only mode → Task 22
- Submissions UI gating → Task 23
- i18n → Task 24
- Manual end-to-end verification → Task 25

**Notable design decisions made by the plan author (using best judgment per user instruction):**
- Email infrastructure: SES (existing), not Resend (which the spec mentioned in passing).
- Route name: `/api/invites/accept/[token]` not `/api/invites/[token]/accept` (avoids segment collision with `[id]`).
- Cookie is `httpOnly: false` so the client switcher can read the active account ID without an API roundtrip on every page; the cookie is not security-sensitive (server-side check still required for every action).
- Members link in nav only shows for OWNERS — non-owners would 404 anyway.
- Plan limits explicitly use the **owner's** subscription, not the acting user's — enforced uniformly across all routes that consult plan limits.
