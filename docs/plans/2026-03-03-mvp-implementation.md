# MVP Implementation Plan: Canadian Form Builder

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working Canadian-hosted form builder SaaS with auth, drag-and-drop form creation (SurveyJS), public form rendering, submissions, email notifications, and CSV export.

**Architecture:** Single Next.js 15 monolith (App Router) with Prisma + PostgreSQL. SurveyJS Creator for the builder UI, SurveyJS Library for public form rendering. Auth.js v5 for authentication. All hosted on AWS ca-central-1.

**Tech Stack:** Next.js 15, TypeScript, SurveyJS Community (MIT), Auth.js v5, Prisma, PostgreSQL 16, Tailwind CSS, Amazon SES

**Design doc:** `docs/plans/2026-03-03-mvp-design.md`

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.env.example`, `.gitignore`, `docker-compose.yml`, `Dockerfile`

**Step 1: Initialize Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Accept defaults. This creates the full Next.js 15 scaffolding with App Router, TypeScript, Tailwind, and ESLint.

**Step 2: Add core dependencies**

```bash
npm install prisma @prisma/client
npm install survey-core survey-creator-core survey-react-ui survey-creator-react
npm install next-auth@beta @auth/prisma-adapter
npm install @aws-sdk/client-ses
npm install uuid
npm install -D @types/uuid
```

**Step 3: Create docker-compose.yml for local Postgres**

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: stelld
      POSTGRES_PASSWORD: localdev
      POSTGRES_DB: stelld
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 4: Create .env.example**

```bash
# Database
DATABASE_URL="postgresql://stelld:localdev@localhost:5432/stelld"

# Auth.js
AUTH_SECRET="generate-with-npx-auth-secret"
AUTH_URL="http://localhost:3000"

# Amazon SES (optional for local dev)
AWS_REGION="ca-central-1"
AWS_ACCESS_KEY_ID=""
AWS_SECRET_ACCESS_KEY=""
SES_FROM_EMAIL="noreply@stelld.ca"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

**Step 5: Copy .env.example to .env.local, start Postgres**

```bash
cp .env.example .env.local
docker compose up -d
```

**Step 6: Verify the dev server starts**

```bash
npm run dev
```

Visit http://localhost:3000 — should see the default Next.js page.

**Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with dependencies"
```

---

## Task 2: Database Schema & Prisma Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

**Step 1: Initialize Prisma**

```bash
npx prisma init
```

This creates `prisma/schema.prisma` and updates `.env` references.

**Step 2: Write the Prisma schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ---- Auth.js tables ----

model User {
  id            String    @id @default(uuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts Account[]
  sessions Session[]
  forms    Form[]

  @@map("users")
}

model Account {
  id                String  @id @default(uuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(uuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
  @@map("verification_tokens")
}

// ---- App tables ----

model Form {
  id          String   @id @default(uuid())
  userId      String
  title       String   @default("Untitled Form")
  description String?
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

model Submission {
  id        String   @id @default(uuid())
  formId    String
  data      Json
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())

  form Form @relation(fields: [formId], references: [id], onDelete: Cascade)

  @@index([formId])
  @@index([createdAt])
  @@map("submissions")
}
```

**Step 3: Create the Prisma client singleton**

```typescript
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Step 4: Run the migration**

```bash
npx prisma migrate dev --name init
```

Expected: Creates migration SQL, applies it, generates Prisma Client.

**Step 5: Verify with Prisma Studio**

```bash
npx prisma studio
```

Visit http://localhost:5555 — should see all tables (users, accounts, sessions, verification_tokens, forms, submissions).

**Step 6: Commit**

```bash
git add prisma/ src/lib/db.ts
git commit -m "feat: add Prisma schema with auth and app tables"
```

---

## Task 3: Auth.js Setup

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/middleware.ts`

**Step 1: Configure Auth.js**

```typescript
// src/lib/auth.ts
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user || !user.password) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) return null;

        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
});
```

**Note:** Credentials provider requires a `password` field on User. We need to add it to the schema.

**Step 2: Add password field to User model in prisma/schema.prisma**

Add to the User model:

```prisma
  password  String?
```

Run migration:

```bash
npx prisma migrate dev --name add-user-password
```

**Step 3: Install bcryptjs**

```bash
npm install bcryptjs
npm install -D @types/bcryptjs
```

**Step 4: Create the Auth.js API route**

```typescript
// src/app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

**Step 5: Create middleware for route protection**

```typescript
// src/middleware.ts
import { auth } from "@/lib/auth";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard") ||
    req.nextUrl.pathname.startsWith("/builder");
  const isOnAuth = req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/signup");

  if (isOnDashboard && !isLoggedIn) {
    return Response.redirect(new URL("/login", req.nextUrl));
  }

  if (isOnAuth && isLoggedIn) {
    return Response.redirect(new URL("/dashboard", req.nextUrl));
  }
});

export const config = {
  matcher: ["/dashboard/:path*", "/builder/:path*", "/login", "/signup"],
};
```

**Step 6: Commit**

```bash
git add src/lib/auth.ts src/app/api/auth/ src/middleware.ts prisma/
git commit -m "feat: configure Auth.js with credentials provider and route protection"
```

---

## Task 4: Signup & Login Pages

**Files:**
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/signup/page.tsx`
- Create: `src/app/api/auth/signup/route.ts`

**Step 1: Create the signup API route**

```typescript
// src/app/api/auth/signup/route.ts
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { name, email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });

  if (existingUser) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 }
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: { name, email, password: hashedPassword },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
```

**Step 2: Create the signup page**

```tsx
// src/app/(auth)/signup/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Something went wrong");
      setLoading(false);
      return;
    }

    router.push("/login?registered=true");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">Stelld</h1>
            <p className="text-sm text-gray-500">Forms built in Canada</p>
          </div>
          <h2 className="text-xl font-semibold mb-6">Create an account</h2>
          {error && <p className="text-red-600 mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">Name</label>
              <input id="name" name="name" type="text" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input id="email" name="email" type="email" required className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
              <input id="password" name="password" type="password" required minLength={8} className="w-full border rounded px-3 py-2" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 disabled:opacity-50">
              {loading ? "Creating account..." : "Sign up"}
            </button>
          </form>
          <p className="mt-4 text-sm text-center">
            Already have an account? <Link href="/login" className="underline">Log in</Link>
          </p>
        </div>
      </div>
      <footer className="py-4 text-center text-xs text-gray-400">Stelld &mdash; Forms built in Canada</footer>
    </div>
  );
}
```

**Step 3: Create the login page**

```tsx
// src/app/(auth)/login/page.tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid email or password");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">Stelld</h1>
            <p className="text-sm text-gray-500">Forms built in Canada</p>
          </div>
          <h2 className="text-xl font-semibold mb-6">Log in</h2>
          {error && <p className="text-red-600 mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">Email</label>
              <input id="email" name="email" type="email" required className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">Password</label>
              <input id="password" name="password" type="password" required className="w-full border rounded px-3 py-2" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-black text-white py-2 rounded hover:bg-gray-800 disabled:opacity-50">
              {loading ? "Logging in..." : "Log in"}
            </button>
          </form>
          <p className="mt-4 text-sm text-center">
            Don&apos;t have an account? <Link href="/signup" className="underline">Sign up</Link>
          </p>
        </div>
      </div>
      <footer className="py-4 text-center text-xs text-gray-400">Stelld &mdash; Forms built in Canada</footer>
    </div>
  );
}
```

**Step 4: Test manually**

1. Visit http://localhost:3000/signup — create an account
2. Visit http://localhost:3000/login — log in
3. Visit http://localhost:3000/dashboard — should redirect to login if not authenticated
4. After login, visiting /login should redirect to /dashboard

**Step 5: Commit**

```bash
git add src/app/(auth)/ src/app/api/auth/signup/
git commit -m "feat: add signup and login pages with credentials auth"
```

---

## Task 5: Dashboard — Form List

**Files:**
- Create: `src/app/(dashboard)/dashboard/page.tsx`
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/api/forms/route.ts`
- Create: `src/components/form-card.tsx`

**Step 1: Create the dashboard layout (auth-protected shell)**

```tsx
// src/app/(dashboard)/layout.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="font-bold text-lg">Stelld</Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{session.user.email}</span>
          <form action={async () => {
            "use server";
            const { signOut } = await import("@/lib/auth");
            await signOut({ redirectTo: "/login" });
          }}>
            <button type="submit" className="text-sm text-gray-500 hover:text-gray-700">
              Log out
            </button>
          </form>
        </div>
      </nav>
      <main className="max-w-6xl mx-auto p-6">{children}</main>
    </div>
  );
}
```

**Step 2: Create the forms API route (list + create)**

```typescript
// src/app/api/forms/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const forms = await prisma.form.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { submissions: true } } },
  });

  return NextResponse.json(forms);
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.create({
    data: {
      userId: session.user.id,
      title: "Untitled Form",
      schema: {},
      settings: { thankYouMessage: "Thank you for your submission!" },
    },
  });

  return NextResponse.json(form, { status: 201 });
}
```

**Step 3: Create a form card component**

```tsx
// src/components/form-card.tsx
"use client";

import Link from "next/link";

interface FormCardProps {
  id: string;
  title: string;
  isPublished: boolean;
  submissionCount: number;
  updatedAt: string;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
}

export function FormCard({
  id, title, isPublished, submissionCount, updatedAt, onDelete, onDuplicate
}: FormCardProps) {
  return (
    <div className="bg-white border rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <Link href={`/builder/${id}`} className="font-medium hover:underline">
            {title}
          </Link>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
            <span className={isPublished ? "text-green-600" : "text-gray-400"}>
              {isPublished ? "Published" : "Draft"}
            </span>
            <span>{submissionCount} submissions</span>
            <span>Updated {new Date(updatedAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/forms/${id}`}
            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
          >
            Submissions
          </Link>
          <button
            onClick={() => onDuplicate(id)}
            className="text-sm px-3 py-1 border rounded hover:bg-gray-50"
          >
            Duplicate
          </button>
          <button
            onClick={() => onDelete(id)}
            className="text-sm px-3 py-1 border rounded text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 4: Create the dashboard page**

```tsx
// src/app/(dashboard)/dashboard/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FormCard } from "@/components/form-card";

interface Form {
  id: string;
  title: string;
  isPublished: boolean;
  updatedAt: string;
  _count: { submissions: number };
}

export default function DashboardPage() {
  const router = useRouter();
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForms();
  }, []);

  async function fetchForms() {
    const res = await fetch("/api/forms");
    const data = await res.json();
    setForms(data);
    setLoading(false);
  }

  async function createForm() {
    const res = await fetch("/api/forms", { method: "POST" });
    const form = await res.json();
    router.push(`/builder/${form.id}`);
  }

  async function deleteForm(id: string) {
    if (!confirm("Delete this form and all its submissions?")) return;
    await fetch(`/api/forms/${id}`, { method: "DELETE" });
    fetchForms();
  }

  async function duplicateForm(id: string) {
    const res = await fetch(`/api/forms/${id}/duplicate`, { method: "POST" });
    if (res.ok) fetchForms();
  }

  if (loading) return <div className="py-12 text-center text-gray-500">Loading...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Forms</h1>
        <button
          onClick={createForm}
          className="bg-black text-white px-4 py-2 rounded hover:bg-gray-800"
        >
          New Form
        </button>
      </div>
      {forms.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p>No forms yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {forms.map((form) => (
            <FormCard
              key={form.id}
              id={form.id}
              title={form.title}
              isPublished={form.isPublished}
              submissionCount={form._count.submissions}
              updatedAt={form.updatedAt}
              onDelete={deleteForm}
              onDuplicate={duplicateForm}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 5: Test manually**

1. Log in, visit /dashboard — should see empty state
2. Click "New Form" — should create a form and redirect to builder (404 for now is fine)
3. Navigate back to /dashboard — should see the form listed

**Step 6: Commit**

```bash
git add src/app/(dashboard)/ src/app/api/forms/ src/components/
git commit -m "feat: add dashboard with form list, create, delete, duplicate"
```

---

## Task 6: Form CRUD API (Update, Delete, Duplicate)

**Files:**
- Create: `src/app/api/forms/[id]/route.ts`
- Create: `src/app/api/forms/[id]/duplicate/route.ts`

**Step 1: Create the single-form API route**

```typescript
// src/app/api/forms/[id]/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(form);
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

  const body = await req.json();

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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.form.deleteMany({
    where: { id, userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
```

**Step 2: Create the duplicate API route**

```typescript
// src/app/api/forms/[id]/duplicate/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const original = await prisma.form.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const duplicate = await prisma.form.create({
    data: {
      userId: session.user.id,
      title: `${original.title} (Copy)`,
      description: original.description,
      schema: original.schema as object,
      settings: original.settings as object,
      isPublished: false,
    },
  });

  return NextResponse.json(duplicate, { status: 201 });
}
```

**Step 3: Test manually**

1. From dashboard, click Delete on a form — should remove it
2. Click Duplicate — should create a copy with "(Copy)" suffix, unpublished
3. Verify in Prisma Studio that records match

**Step 4: Commit**

```bash
git add src/app/api/forms/
git commit -m "feat: add form update, delete, and duplicate API routes"
```

---

## Task 7: Form Builder Page (SurveyJS Creator)

**Files:**
- Create: `src/app/builder/[id]/page.tsx`
- Create: `src/components/form-builder.tsx`

**Step 1: Create the builder client component**

```tsx
// src/components/form-builder.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SurveyCreatorComponent, SurveyCreator } from "survey-creator-react";
import "survey-core/defaultV2.min.css";
import "survey-creator-core/survey-creator-core.min.css";

interface FormBuilderProps {
  formId: string;
  initialSchema: object;
  initialTitle: string;
  isPublished: boolean;
}

export function FormBuilder({ formId, initialSchema, initialTitle, isPublished }: FormBuilderProps) {
  const [title, setTitle] = useState(initialTitle);
  const [published, setPublished] = useState(isPublished);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const creatorRef = useRef<SurveyCreator | null>(null);

  useEffect(() => {
    const creator = new SurveyCreator({
      showLogicTab: true,
      showJSONEditorTab: true,
      isAutoSave: false,
    });

    if (Object.keys(initialSchema).length > 0) {
      creator.JSON = initialSchema;
    }

    creator.saveSurveyFunc = (saveNo: number, callback: (no: number, success: boolean) => void) => {
      saveForm(creator.JSON).then(() => callback(saveNo, true));
    };

    creatorRef.current = creator;

    // Auto-save on change (debounced 3s)
    const originalModified = creator.onModified;
    creator.onModified.add(() => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveForm(creator.JSON);
      }, 3000);
    });

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const saveForm = useCallback(async (schema?: object) => {
    setSaving(true);
    await fetch(`/api/forms/${formId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        schema: schema ?? creatorRef.current?.JSON,
      }),
    });
    setSaving(false);
    setLastSaved(new Date());
  }, [formId, title]);

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
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">&larr; Dashboard</a>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => saveForm()}
            className="font-medium text-lg border-none outline-none focus:ring-1 focus:ring-gray-300 rounded px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {saving ? "Saving..." : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ""}
          </span>
          {published && (
            <a
              href={`/f/${formId}`}
              target="_blank"
              className="text-sm text-blue-600 hover:underline"
            >
              View live form
            </a>
          )}
          <button
            onClick={togglePublish}
            className={`text-sm px-4 py-1.5 rounded ${
              published
                ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                : "bg-green-600 text-white hover:bg-green-700"
            }`}
          >
            {published ? "Unpublish" : "Publish"}
          </button>
        </div>
      </div>

      {/* SurveyJS Creator */}
      <div className="flex-1">
        {creatorRef.current && <SurveyCreatorComponent creator={creatorRef.current} />}
      </div>
    </div>
  );
}
```

**Step 2: Create the builder page (Server Component that fetches form, then renders client component)**

```tsx
// src/app/builder/[id]/page.tsx
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { FormBuilder } from "@/components/form-builder";

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const form = await prisma.form.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!form) notFound();

  return (
    <FormBuilder
      formId={form.id}
      initialSchema={form.schema as object}
      initialTitle={form.title}
      isPublished={form.isPublished}
    />
  );
}
```

**Step 3: Test manually**

1. From dashboard, click "New Form" — should land on builder page
2. SurveyJS Creator should load with drag-and-drop interface
3. Add some fields, wait 3 seconds — should see "Saving..." then "Saved"
4. Rename the form title, click away — should save
5. Click Publish — button should toggle
6. Refresh the page — all changes should persist

**Step 4: Commit**

```bash
git add src/app/builder/ src/components/form-builder.tsx
git commit -m "feat: add form builder page with SurveyJS Creator and auto-save"
```

---

## Task 8: Public Form Renderer

**Files:**
- Create: `src/app/f/[id]/page.tsx`
- Create: `src/components/form-renderer.tsx`
- Create: `src/app/api/submissions/route.ts`

**Step 1: Create the submission API route**

```typescript
// src/app/api/submissions/route.ts
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { headers } from "next/headers";

// Simple in-memory rate limiter
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + 60000 });
    return false;
  }
  entry.count++;
  return entry.count > 10; // 10 per minute
}

export async function POST(req: Request) {
  const headersList = await headers();
  const ip = headersList.get("x-forwarded-for") ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many submissions" }, { status: 429 });
  }

  const { formId, data, honeypot } = await req.json();

  // Honeypot check — if filled, silently succeed (don't tell bots it failed)
  if (honeypot) {
    return NextResponse.json({ success: true });
  }

  if (!formId || !data) {
    return NextResponse.json({ error: "Missing form ID or data" }, { status: 400 });
  }

  const form = await prisma.form.findFirst({
    where: { id: formId, isPublished: true },
    include: { user: { select: { email: true, name: true } } },
  });

  if (!form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  await prisma.submission.create({
    data: {
      formId,
      data,
      metadata: {
        userAgent: headersList.get("user-agent") ?? "",
        referer: headersList.get("referer") ?? "",
        submittedAt: new Date().toISOString(),
      },
    },
  });

  // TODO (Task 11): Send email notification to form.user.email

  return NextResponse.json({ success: true }, { status: 201 });
}
```

**Step 2: Create the form renderer client component**

```tsx
// src/components/form-renderer.tsx
"use client";

import { useCallback, useState } from "react";
import { Model } from "survey-core";
import { Survey } from "survey-react-ui";
import "survey-core/defaultV2.min.css";

interface FormRendererProps {
  formId: string;
  schema: object;
  thankYouMessage: string;
}

export function FormRenderer({ formId, schema, thankYouMessage }: FormRendererProps) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const onComplete = useCallback(async (sender: Model) => {
    const res = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formId,
        data: sender.data,
        honeypot: (document.getElementById("_hp_field") as HTMLInputElement)?.value ?? "",
      }),
    });

    if (!res.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
  }, [formId]);

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center p-8">
          <h2 className="text-2xl font-bold mb-2">Thank you!</h2>
          <p className="text-gray-600">{thankYouMessage}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const survey = new Model(schema);
  survey.onComplete.add(onComplete);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      {/* Honeypot — hidden from humans, visible to bots */}
      <input
        id="_hp_field"
        name="_hp_field"
        type="text"
        style={{ position: "absolute", left: "-9999px", tabIndex: -1 } as React.CSSProperties}
        autoComplete="off"
        aria-hidden="true"
      />
      <div className="max-w-3xl mx-auto">
        <Survey model={survey} />
      </div>
    </div>
  );
}
```

**Step 3: Create the public form page (Server Component)**

```tsx
// src/app/f/[id]/page.tsx
import { prisma } from "@/lib/db";
import { notFound } from "next/navigation";
import { FormRenderer } from "@/components/form-renderer";

export default async function PublicFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const form = await prisma.form.findFirst({
    where: { id, isPublished: true },
  });

  if (!form) notFound();

  const settings = form.settings as { thankYouMessage?: string };

  return (
    <FormRenderer
      formId={form.id}
      schema={form.schema as object}
      thankYouMessage={settings.thankYouMessage ?? "Thank you for your submission!"}
    />
  );
}
```

**Step 4: Test manually**

1. Create a form in the builder, add a few fields, publish it
2. Visit `/f/[form-id]` — should see the rendered form
3. Fill it out and submit — should see thank-you message
4. Check Prisma Studio — submission row should exist with the data
5. Visit `/f/nonexistent-id` — should see 404
6. Unpublish the form — visiting the link should now 404

**Step 5: Commit**

```bash
git add src/app/f/ src/components/form-renderer.tsx src/app/api/submissions/
git commit -m "feat: add public form renderer with submissions and spam protection"
```

---

## Task 9: Submissions Dashboard

**Files:**
- Create: `src/app/(dashboard)/dashboard/forms/[id]/page.tsx`
- Create: `src/app/api/forms/[id]/submissions/route.ts`
- Create: `src/components/submissions-table.tsx`

**Step 1: Create the submissions list API route**

```typescript
// src/app/api/forms/[id]/submissions/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify form belongs to user
  const form = await prisma.form.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const submissions = await prisma.submission.findMany({
    where: { formId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ form, submissions });
}
```

**Step 2: Create a submissions table component**

```tsx
// src/components/submissions-table.tsx
"use client";

import { useState } from "react";

interface Submission {
  id: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface SubmissionsTableProps {
  submissions: Submission[];
  formSchema: object;
}

export function SubmissionsTable({ submissions, formSchema }: SubmissionsTableProps) {
  const [selected, setSelected] = useState<Submission | null>(null);

  // Extract column names from the first submission's data keys
  // or from the form schema questions
  const columns = getColumnsFromSubmissions(submissions);

  if (submissions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No submissions yet. Share your form to start collecting responses.
      </div>
    );
  }

  return (
    <div>
      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">Submission Detail</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
            </div>
            <dl className="space-y-3">
              {Object.entries(selected.data).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm font-medium text-gray-500">{key}</dt>
                  <dd className="mt-1">{String(value)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-gray-400">
              Submitted {new Date(selected.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-3 font-medium text-gray-500">Date</th>
              {columns.slice(0, 5).map((col) => (
                <th key={col} className="text-left py-2 px-3 font-medium text-gray-500">{col}</th>
              ))}
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((sub) => (
              <tr key={sub.id} className="border-b hover:bg-gray-50">
                <td className="py-2 px-3 text-gray-500">
                  {new Date(sub.createdAt).toLocaleDateString()}
                </td>
                {columns.slice(0, 5).map((col) => (
                  <td key={col} className="py-2 px-3 max-w-[200px] truncate">
                    {String(sub.data[col] ?? "")}
                  </td>
                ))}
                <td className="py-2 px-3">
                  <button
                    onClick={() => setSelected(sub)}
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getColumnsFromSubmissions(submissions: Submission[]): string[] {
  const keys = new Set<string>();
  for (const sub of submissions) {
    for (const key of Object.keys(sub.data)) {
      keys.add(key);
    }
  }
  return Array.from(keys);
}
```

**Step 3: Create the form submissions page**

```tsx
// src/app/(dashboard)/dashboard/forms/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { SubmissionsTable } from "@/components/submissions-table";

interface FormData {
  id: string;
  title: string;
  schema: object;
  isPublished: boolean;
}

interface Submission {
  id: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export default function FormSubmissionsPage() {
  const params = useParams();
  const formId = params.id as string;
  const [form, setForm] = useState<FormData | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/forms/${formId}/submissions`);
      if (res.ok) {
        const data = await res.json();
        setForm(data.form);
        setSubmissions(data.submissions);
      }
      setLoading(false);
    }
    load();
  }, [formId]);

  if (loading) return <div className="py-12 text-center text-gray-500">Loading...</div>;
  if (!form) return <div className="py-12 text-center text-gray-500">Form not found.</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">&larr; All forms</Link>
          <h1 className="text-2xl font-bold mt-1">{form.title}</h1>
          <p className="text-sm text-gray-500">{submissions.length} submissions</p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/builder/${formId}`}
            className="text-sm px-4 py-2 border rounded hover:bg-gray-50"
          >
            Edit form
          </Link>
          <a
            href={`/api/forms/${formId}/submissions/export`}
            className="text-sm px-4 py-2 bg-black text-white rounded hover:bg-gray-800"
          >
            Export CSV
          </a>
        </div>
      </div>

      <SubmissionsTable submissions={submissions} formSchema={form.schema} />
    </div>
  );
}
```

**Step 4: Test manually**

1. Submit a few responses on a published form
2. Visit the form's submissions page from dashboard
3. Should see table with date and response data
4. Click "View" — should see full submission detail in modal

**Step 5: Commit**

```bash
git add src/app/(dashboard)/dashboard/forms/ src/app/api/forms/[id]/submissions/ src/components/submissions-table.tsx
git commit -m "feat: add submissions dashboard with table view and detail modal"
```

---

## Task 10: CSV Export

**Files:**
- Create: `src/app/api/forms/[id]/submissions/export/route.ts`

**Step 1: Create the CSV export API route**

```typescript
// src/app/api/forms/[id]/submissions/export/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await prisma.form.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!form) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const submissions = await prisma.submission.findMany({
    where: { formId: id },
    orderBy: { createdAt: "desc" },
  });

  // Collect all unique keys across submissions
  const allKeys = new Set<string>();
  for (const sub of submissions) {
    const data = sub.data as Record<string, unknown>;
    for (const key of Object.keys(data)) {
      allKeys.add(key);
    }
  }

  const columns = ["Submitted At", ...Array.from(allKeys)];

  // Build CSV
  const escapeCsv = (val: unknown): string => {
    const str = val === null || val === undefined ? "" : String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [columns.map(escapeCsv).join(",")];
  for (const sub of submissions) {
    const data = sub.data as Record<string, unknown>;
    const row = [
      escapeCsv(sub.createdAt.toISOString()),
      ...Array.from(allKeys).map((key) => escapeCsv(data[key])),
    ];
    rows.push(row.join(","));
  }

  const csv = rows.join("\n");
  const filename = `${form.title.replace(/[^a-zA-Z0-9]/g, "_")}_submissions.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
```

**Step 2: Test manually**

1. Go to a form's submissions page
2. Click "Export CSV"
3. Browser should download a CSV file
4. Open it in a spreadsheet — columns should be field names, rows should be submissions

**Step 3: Commit**

```bash
git add src/app/api/forms/[id]/submissions/export/
git commit -m "feat: add CSV export for form submissions"
```

---

## Task 11: Email Notifications (SES)

**Files:**
- Create: `src/lib/email.ts`
- Modify: `src/app/api/submissions/route.ts` — add email notification call

**Step 1: Create the email utility**

```typescript
// src/lib/email.ts
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "ca-central-1" });

const fromEmail = process.env.SES_FROM_EMAIL ?? "noreply@stelld.ca";

export async function sendSubmissionNotification(
  toEmail: string,
  formTitle: string,
  formId: string,
  submissionId: string
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const dashboardLink = `${appUrl}/dashboard/forms/${formId}`;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: { Data: `New response on "${formTitle}"` },
          Body: {
            Html: {
              Data: `
                <p>You received a new submission on your form <strong>${formTitle}</strong>.</p>
                <p><a href="${dashboardLink}">View submissions in your dashboard</a></p>
              `,
            },
            Text: {
              Data: `You received a new submission on your form "${formTitle}". View it at: ${dashboardLink}`,
            },
          },
        },
      })
    );
  } catch (error) {
    // Log but don't fail the submission if email fails
    console.error("Failed to send notification email:", error);
  }
}
```

**Step 2: Add email notification to the submission API route**

In `src/app/api/submissions/route.ts`, after the `prisma.submission.create()` call, add:

```typescript
import { sendSubmissionNotification } from "@/lib/email";

// ... after creating submission:

// Send notification (fire-and-forget, don't await)
sendSubmissionNotification(
  form.user.email!,
  form.title,
  form.id,
  submission.id
);
```

Update the `prisma.submission.create()` call to capture the result:

```typescript
const submission = await prisma.submission.create({ ... });
```

**Step 3: Test**

- In local dev without SES credentials, the email will log an error to console but the submission will succeed. That's the expected behavior.
- To test emails: set up SES sandbox credentials in `.env.local` and verify a recipient address.

**Step 4: Commit**

```bash
git add src/lib/email.ts src/app/api/submissions/route.ts
git commit -m "feat: add email notifications on form submission via SES"
```

---

## Task 12: Dockerfile & Production Build

**Files:**
- Create: `Dockerfile`
- Modify: `next.config.ts` — add standalone output

**Step 1: Update next.config.ts for standalone output**

```typescript
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

**Step 2: Create the Dockerfile**

```dockerfile
# Dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

**Step 3: Test the Docker build**

```bash
docker build -t stelld .
docker run -p 3000:3000 --env-file .env.local stelld
```

Visit http://localhost:3000 — should work.

**Step 4: Commit**

```bash
git add Dockerfile next.config.ts
git commit -m "feat: add Dockerfile with standalone Next.js build"
```

---

## Task 13: Polish & Smoke Test

**Files:**
- Modify: `src/app/page.tsx` — redirect to dashboard or show landing
- Verify all flows end-to-end

**Step 1: Update the root page**

```tsx
// src/app/page.tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-2">Stelld</h1>
          <p className="text-lg text-gray-600 mb-6">
            Forms built in Canada
          </p>
          <blockquote className="text-sm text-gray-400 italic mb-8 max-w-md mx-auto">
            &ldquo;Mine eye hath play&apos;d the painter and hath stell&apos;d / Thy beauty&apos;s form in table of my heart.&rdquo;
            <span className="block mt-1 not-italic">&mdash; William Shakespeare, Sonnet 24</span>
          </blockquote>
          <div className="flex gap-4 justify-center">
            <Link href="/signup" className="bg-black text-white px-6 py-2 rounded hover:bg-gray-800">
              Get started
            </Link>
            <Link href="/login" className="border px-6 py-2 rounded hover:bg-gray-50">
              Log in
            </Link>
          </div>
        </div>
      </div>
      <footer className="py-4 text-center text-xs text-gray-400">Stelld &mdash; Forms built in Canada</footer>
    </div>
  );
}
```

**Step 2: Full smoke test**

Run through these manually:

1. Visit `/` — see landing page
2. Click "Get started" — go to signup
3. Create account — redirect to login
4. Log in — redirect to dashboard (empty)
5. Click "New Form" — land in builder
6. Add 3 fields (text, dropdown, checkbox), rename form
7. Wait for auto-save, verify by refreshing page
8. Click Publish — see "View live form" link
9. Open live form link in incognito window
10. Fill out and submit — see thank-you message
11. Back in dashboard, view submissions — see the response
12. Click "View" — see full detail
13. Click "Export CSV" — download file, verify contents
14. Duplicate the form — see copy in dashboard
15. Delete a form — confirm it's gone
16. Log out — redirect to login
17. Try visiting /dashboard — redirect to login

**Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add landing page with auth redirect"
```

---

## Summary

| Task | What it builds | Depends on |
|---|---|---|
| 1 | Project scaffolding, deps, Docker Compose | — |
| 2 | Prisma schema, migrations, DB client | 1 |
| 3 | Auth.js config, route protection | 2 |
| 4 | Signup + login pages | 3 |
| 5 | Dashboard with form list | 4 |
| 6 | Form CRUD API (update, delete, duplicate) | 5 |
| 7 | Form builder (SurveyJS Creator) | 6 |
| 8 | Public form renderer + submissions API | 7 |
| 9 | Submissions dashboard (table + detail) | 8 |
| 10 | CSV export | 9 |
| 11 | Email notifications (SES) | 8 |
| 12 | Dockerfile + production build | 11 |
| 13 | Landing page + full smoke test | 12 |

Tasks 10 and 11 can be done in parallel (both depend on 8/9 but not each other).
