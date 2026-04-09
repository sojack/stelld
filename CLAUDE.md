# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Stelld** — a Canadian-first form builder SaaS. Lean alternative to JotForm that stores all data in Canada. Initial target is Canadian small businesses; government/enterprise comes later.

Name inspired by Shakespeare's Sonnet 24: "stell'd / Thy beauty's form in table of my heart."

See `docs/plans/2026-03-03-mvp-design.md` for the full approved design.

## Tech Stack

- **Framework**: Next.js 15 (App Router), TypeScript
- **Form Engine**: SurveyJS Community (MIT) — Creator for builder, Library for renderer
- **Auth**: Auth.js v5 (self-hosted)
- **ORM**: Prisma
- **Database**: PostgreSQL 16 (RDS, ca-central-1)
- **Email**: Resend (transactional — password resets, submission notifications)
- **Styling**: Tailwind CSS
- **Infrastructure**: AWS ca-central-1 — EC2 + ALB, RDS, S3

## Architecture

Single Next.js monolith. No separate backend service. API routes handle all server logic.

- **Server Components** for dashboard (auth-protected pages)
- **Client Components** for builder page (SurveyJS needs DOM)
- **API Routes** for form CRUD, submissions, auth
- Public forms served at `/f/[form-id]`, no auth required for respondents

## Database Schema

- `users` — managed by Auth.js (id, name, email, etc.)
- `forms` — id, user_id, title, description, schema (JSONB), settings (JSONB), is_published
- `submissions` — id, form_id, data (JSONB), metadata (JSONB)

No multi-tenant RLS — queries filter by `user_id`. The JSONB `schema` column stores SurveyJS JSON directly; no transformation between builder and renderer.

## Project Structure

```
├── prisma/schema.prisma
├── src/
│   ├── app/
│   │   ├── (auth)/             # Login, signup, password reset
│   │   ├── (dashboard)/forms/  # Form list, detail, submissions
│   │   ├── builder/[id]/       # SurveyJS Creator
│   │   ├── f/[id]/             # Public form renderer
│   │   └── api/                # auth, forms, submissions endpoints
│   ├── components/
│   ├── lib/                    # DB client, email, auth config
│   └── types/
├── Dockerfile
├── docker-compose.yml          # Local dev (app + postgres)
└── package.json
```

## Key Conventions

- Form schemas are SurveyJS JSON stored as-is in JSONB — no custom schema format
- Auto-save in builder: debounced PUT every 3 seconds on change
- Public submission endpoint is unauthenticated — protected by rate limiting + honeypot
- Email notifications are simple "new response" alerts with a dashboard link
- CSV export generates on-the-fly (no background jobs)
- Data model is i18n-ready (SurveyJS supports localized strings in JSON) but MVP is English-only
- See `docs/infrastructure.md` for deployment, Docker, and ops details

## Feature Roadmap

1. **MVP**: Auth, form builder (SurveyJS Creator), public forms, submissions, email notifications, CSV export — **complete**
2. **Phase 2**: File uploads (S3), bilingual FR/EN — **bilingual complete**
3. **Phase 3**: Payments (Stripe/Helcim), subdomains, multi-user orgs — **Stripe integration complete**
4. **Phase 4**: Audit logs, PIPEDA "Vault" mode, per-tenant encryption

## Project Status

Deployed to production at stelld.ca. MVP features complete, bilingual (EN/FR) complete, Stripe payments complete (subscriptions + Connect + form payment collection).
