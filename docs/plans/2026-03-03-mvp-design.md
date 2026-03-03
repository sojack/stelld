# MVP Design: Canadian Form Builder SaaS

**Date:** 2026-03-03
**Status:** Approved
**Target launch:** 1-2 months
**Target audience:** Canadian small businesses

## Overview

A lean, Canadian-hosted form builder — a JotForm alternative that stores all data in Canada. Built as a thin wrapper around SurveyJS (MIT community edition) with Next.js, Auth.js, and PostgreSQL on AWS ca-central-1.

The MVP focuses on a working form builder with auth, submissions, email notifications, and CSV export. Bilingual support, payment collection, audit logs, and enterprise compliance features are deferred to later phases.

## Architecture

```
Browser
  └── Next.js App (App Router)
       ├── /dashboard  — Auth-protected, form management
       ├── /builder    — SurveyJS Creator (drag-and-drop editor)
       ├── /f/[id]     — Public form renderer (SurveyJS Library)
       └── /api        — Next.js API routes
            ├── /api/auth        — Auth.js (NextAuth v5)
            ├── /api/forms       — CRUD for form definitions
            └── /api/submissions — Submit + list/export

PostgreSQL (RDS, ca-central-1)
  └── Tables: users, forms, submissions

S3 (ca-central-1, Phase 2)
  └── File uploads
```

Single Next.js monolith — no separate backend service. API routes handle all server logic. This is the fastest path to launch and scales well for early-stage traffic.

### Key architectural decisions

- **App Router** (not Pages Router) — current Next.js standard
- **Server Components** for dashboard pages (fast loads, less client JS)
- **Client Components** for the builder page (SurveyJS requires DOM access)
- **API Routes** for form CRUD and submissions — no separate Express server
- **No state management library** initially — React Server Components + SurveyJS manage their own state. Add Zustand only if needed.

## Tech Stack

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | Next.js 15 (App Router) | SSR for public forms, React for builder |
| Language | TypeScript | Type safety across full stack |
| Form Engine | SurveyJS Community (MIT) | Creator (builder) + Library (renderer) |
| Auth | Auth.js v5 | Self-hosted, free, Next.js native |
| ORM | Prisma | Typed queries, migrations, Next.js integration |
| Database | PostgreSQL 16 (RDS) | JSONB for form schemas |
| Email | Amazon SES | ca-central-1, $0.10/1000 emails |
| Styling | Tailwind CSS | Fast to build, easy to theme SurveyJS |

### Infrastructure (AWS ca-central-1)

| Service | Purpose |
|---|---|
| EC2 (t3.small) + ALB | Runs Next.js in Docker. ASG min=1 for auto-recovery. |
| RDS PostgreSQL | Managed DB, automated backups, encryption at rest |
| SES | Transactional email |
| S3 | File uploads (Phase 2), static assets |
| ACM | SSL certificates |
| Route 53 | DNS |

CloudFront CDN is optional at launch — easy to add later for public form page performance.

## Data Model

Three tables. Intentionally simple — no multi-tenant RLS. User-scoped queries filter by `user_id`.

### `users`

Managed by Auth.js. Standard fields:

- `id` (UUID, PK)
- `name`, `email`, `email_verified`, `image`
- `created_at`, `updated_at`

Auth.js also creates `accounts`, `sessions`, and `verification_tokens` tables automatically.

### `forms`

- `id` (UUID, PK)
- `user_id` (UUID, FK -> users) — form owner
- `title` (text)
- `description` (text, nullable)
- `schema` (JSONB) — the SurveyJS JSON definition (entire form structure)
- `settings` (JSONB) — notification preferences, thank-you message, config
- `is_published` (boolean, default false)
- `created_at`, `updated_at`

### `submissions`

- `id` (UUID, PK)
- `form_id` (UUID, FK -> forms)
- `data` (JSONB) — submitted answers, directly from SurveyJS
- `metadata` (JSONB) — submitted_at, user-agent, referer
- `created_at`

### What's deliberately missing

- No `tenants` table — users are the tenants. Add organizations later.
- No `audit_logs` — deferred to enterprise phase.
- No `translations` column — SurveyJS JSON schema supports localized strings natively; add when i18n is built.
- No `data_residency` column — single region (ca-central-1), no routing logic needed.

## MVP Features

### Auth & Accounts
- Email/password signup and login (Auth.js)
- Password reset flow
- Simple user profile (name, email)

### Dashboard
- List of user's forms (title, status, submission count, date)
- Create, duplicate, delete forms
- Toggle published/draft

### Form Builder
- SurveyJS Creator embedded full-page
- All standard field types (~20: text, textarea, radio, checkbox, dropdown, rating, date, matrix, ranking, boolean, panel, dynamic panel, etc.)
- Conditional branching and validation rules (SurveyJS built-in, enabled)
- Auto-save schema on change (debounced, every 3 seconds)
- Manual save button
- Preview mode

### Public Form Page
- Served at `yourapp.ca/f/[form-id]`
- 404 if form is draft/unpublished
- SurveyJS Library renders the form
- Configurable thank-you message on completion
- No login required for respondents

### Submissions
- Table view of submissions per form, sortable by date
- View individual submission detail
- CSV export (download all submissions for a form)
- Email notification to form owner on new submission (link to dashboard)

### Email (SES)
- Auth emails: verify address, password reset
- Submission notification: "New response on [Form Title]" with link

## Core Technical Flows

### Form Creation & Editing

```
User clicks "New Form"
  -> API creates forms row with empty schema ({})
  -> Redirect to /builder/[form-id]
  -> SurveyJS Creator loads with saved schema
  -> User drags fields, configures options
  -> Auto-save: debounced PUT /api/forms/[id] every 3s on change
  -> "Publish" sets is_published = true
```

SurveyJS Creator emits JSON on every change. Store it directly in the `schema` column. SurveyJS Library reads the same JSON to render — no transformation.

### Form Submission

```
Respondent visits /f/[form-id]
  -> Server Component fetches form
  -> Not published -> 404
  -> Renders SurveyJS Library with schema
  -> User fills out, submits
  -> onComplete callback POSTs to /api/submissions { form_id, data }
  -> API validates form_id exists and is published
  -> Inserts submission row
  -> Sends async email notification to form owner (SES)
  -> Returns success -> shows thank-you message
```

Public endpoint protections:
- Rate limiting: 10 submissions per IP per minute (in-memory middleware)
- Honeypot field: hidden field that bots fill, humans don't
- Add Cloudflare Turnstile later if spam is a problem

### CSV Export

```
User clicks "Export CSV"
  -> GET /api/forms/[id]/submissions/export
  -> Fetch all submissions for the form
  -> Flatten JSONB data (SurveyJS field names become column headers)
  -> Stream CSV with Content-Disposition: attachment
```

On-the-fly generation — no background jobs needed at early-stage volumes.

## Project Structure

```
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/
│   │   ├── (auth)/               # Login, signup, password reset
│   │   ├── (dashboard)/          # Protected dashboard routes
│   │   │   ├── forms/            # Form list, detail, submissions
│   │   │   └── settings/         # User profile
│   │   ├── builder/[id]/         # SurveyJS Creator page
│   │   ├── f/[id]/               # Public form renderer
│   │   └── api/
│   │       ├── auth/             # Auth.js endpoints
│   │       ├── forms/            # Form CRUD
│   │       └── submissions/      # Submit, list, export
│   ├── components/               # Shared React components
│   ├── lib/                      # Utilities (db, email, auth config)
│   └── types/                    # TypeScript types
├── Dockerfile
├── docker-compose.yml            # Local dev (app + postgres)
└── package.json
```

## Canadian Hosting: What We Can Claim

**True at launch:**
- Database (RDS) in ca-central-1 — all data stored in Montreal
- App server (EC2) in ca-central-1 — processing in Canada
- Email (SES) in ca-central-1
- RDS encryption at rest (AWS-managed key)
- Automated backups stay in-region

**Honest claim:** "Your form data is stored and processed entirely in Canada."

**Not claiming yet:** PIPEDA certification, government-grade security, formal DPA. These come with Phase 4.

**Low-effort credibility wins:**
- HTTPS everywhere (ACM + ALB)
- Secure cookie flags (Auth.js default)
- `/security` page on marketing site explaining data residency

## Deferred Features (Post-MVP Phases)

| Feature | Phase | Notes |
|---|---|---|
| File uploads | 2 | S3 presigned URLs, virus scanning |
| Bilingual FR/EN | 2-3 | SurveyJS has native locale support, data model is ready |
| Payment collection | 3 | Stripe Canada + Helcim |
| Subdomains / custom domains | 3 | DNS, routing, wildcard SSL |
| Multi-user organizations | 3 | Teams, roles, shared forms |
| Audit logs | 4 | Immutable log table |
| PIPEDA "Vault" mode | 4 | Per-tenant KMS, DPA, SCPs |
| Form-to-PDF templates | 4+ | Canadian government form mapping |

## Risks & Mitigations

### SurveyJS lock-in
Form schemas are JSON stored in your database — you own the data. Community edition is MIT-licensed. If you need to switch engines, write a schema migration. Acceptable risk.

### Generic-looking builder UI
SurveyJS Creator is functional but not distinctive. Fine for MVP — differentiation is "hosted in Canada." Post-launch, invest in custom theming or evolve to a custom builder UI with SurveyJS as the renderer only.

### Spam on public forms
Ship with honeypot field + rate limiting. Add Cloudflare Turnstile (free) in the first weeks if needed.

### Single instance availability
ASG with min=1 auto-replaces failed instances. Bump to min=2 for real HA when needed — config change, not architecture change.

### "Canadian-hosted" isn't a moat
It's a wedge to get in the door. The moat comes from being first, building trust, and shipping a good product. Move fast.
