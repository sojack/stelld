# Payments Design: Stelld — SaaS Billing + Form Payment Collection

**Date:** 2026-03-07
**Status:** Approved
**Provider:** Stripe (Canadian entity — Stripe Payments Canada Ltd)

## Overview

Two payment systems:
1. **SaaS subscriptions** — Stelld charges users monthly/yearly for Pro and Business plans via Stripe Checkout + Customer Portal
2. **Form payment collection** — Business-tier authors collect payments from respondents via Stripe Connect

## Subscription Tiers

| | Free | Pro ($19/mo) | Business ($49/mo) |
|---|---|---|---|
| Forms | 5 | 50 | Unlimited |
| Submissions/mo | 100 | 1,000 | 10,000 |
| Payment collection | No | No | Yes (Stripe Connect) |
| Email notifications | Yes | Yes | Yes |
| CSV export | Yes | Yes | Yes |
| File uploads (Phase 2) | 100MB | 1GB | 10GB |

Annual discount: ~17% off (Pro $190/yr, Business $490/yr).

New users default to Free plan.

## Database Changes

### Subscription model (1:1 with User)

- `id` (UUID, PK)
- `userId` (UUID, FK -> users, unique)
- `stripeCustomerId` (string) — Stripe customer ID
- `stripeSubscriptionId` (string, nullable) — Stripe subscription ID
- `plan` (enum: FREE / PRO / BUSINESS)
- `status` (enum: ACTIVE / PAST_DUE / CANCELED / TRIALING)
- `currentPeriodEnd` (DateTime) — when the billing period ends
- `cancelAtPeriodEnd` (boolean) — if user chose to cancel
- `createdAt`, `updatedAt`

### StripeConnect model (1:1 with User, Business only)

- `id` (UUID, PK)
- `userId` (UUID, FK -> users, unique)
- `stripeAccountId` (string) — Connected account ID
- `onboardingComplete` (boolean)
- `payoutsEnabled` (boolean)
- `createdAt`, `updatedAt`

No Subscription row is created until a user upgrades from Free. Tier limits are enforced in API routes by checking the user's plan (defaulting to FREE if no Subscription row exists).

## API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/billing/checkout` | POST | Creates Stripe Checkout session, returns URL |
| `/api/billing/portal` | POST | Creates Stripe Customer Portal session, returns URL |
| `/api/billing/status` | GET | Returns current plan, limits, usage counts |
| `/api/billing/webhook` | POST | Stripe webhook handler |
| `/api/billing/connect` | POST | Initiates Stripe Connect onboarding |
| `/api/billing/connect/callback` | GET | OAuth callback after Connect onboarding |

### Webhook events

- `checkout.session.completed` — create/update Subscription row
- `invoice.paid` — extend `currentPeriodEnd`, set status ACTIVE
- `invoice.payment_failed` — set status PAST_DUE
- `customer.subscription.updated` — plan changes, cancellation scheduling
- `customer.subscription.deleted` — set status CANCELED, revert to FREE
- `account.updated` (Connect) — update onboarding/payout status

### Limit enforcement

1. `POST /api/forms` — check form count against plan limit before creating
2. `POST /api/submissions` — check monthly submission count against plan limit before accepting

## Frontend

### Dashboard billing page (`/dashboard/billing`)

- Shows current plan, usage (forms used / limit, submissions this month / limit)
- "Upgrade" button → `/api/billing/checkout` → Stripe Checkout → return to `/dashboard/billing?result=success`
- "Manage Billing" button → `/api/billing/portal` → Stripe Customer Portal
- Business tier: "Connect Stripe Account" button → Connect onboarding, status display

### Usage indicators

- Forms list page: subtle count "3 / 5 forms used" with upgrade prompt near limit
- Submission limit reached: public form shows "This form is not currently accepting responses" (no billing details exposed to respondents)

### No public pricing page yet

Upgrade flow only accessible from inside the dashboard. Public pricing page deferred to marketing site work.

## Form Payment Collection (Business Only)

### Builder

- New "Payment" field type in field palette
- Greyed out with "Business plan" badge for Free/Pro users
- Config: amount (fixed or user-entered), currency (CAD/USD), description
- Stored in form schema like any other field

### Respondent flow

1. Respondent fills out form, reaches payment field
2. On submit, Stelld creates a Stripe Checkout session via the author's Connected Account
3. Respondent redirected to Stripe to pay, then back to thank-you page
4. Submission saved only after successful payment (webhook confirms)

### Money flow

```
Respondent pays $50
  → Stripe fees: ~2.9% + 30¢ ($1.75)
  → Stelld platform fee: 2% ($1.00)
  → Form author receives: $47.25
```

Platform fee applied via Stripe Connect `application_fee_amount`. Stripe handles the split.

### Refunds

Handled through the author's own Stripe Dashboard. No refund UI in Stelld initially.

## Architecture Decisions

- **Stripe Checkout + Customer Portal** (not Stripe Elements) — fastest to build, PCI-compliant out of the box, Stripe handles payment forms/invoices/receipts/plan changes
- **Stripe Connect** for form payment collection — industry standard for marketplace/platform payments, authors connect their own Stripe accounts via OAuth
- **No Helcim initially** — Stripe's Canadian entity satisfies the "Canadian processing" requirement. Helcim can be added as an alternative later if needed.
