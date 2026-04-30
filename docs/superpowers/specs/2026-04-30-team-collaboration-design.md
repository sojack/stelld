# Team Collaboration — Design

**Date:** 2026-04-30
**Status:** Approved (pending user review of this document)

## Summary

Add team collaboration to Stelld so account owners can invite others as **Viewer** or **Editor** of their account. Every user keeps a personal account and can additionally be a member of any number of other accounts they were invited to. Member-count limits are enforced per plan: FREE = 1, PRO = 5, BUSINESS = unlimited. Invites are sent by email and accepted via a tokenized link that supports both signup-and-join and login-and-join in a single flow.

## Goals

- Owners can invite other users to their account with a Viewer or Editor role.
- Invitees can sign up or log in via the invite link in one step.
- Account scope is enforced server-side on every read/write of forms and submissions.
- Plan member-count limits are enforced.
- Existing single-user behavior is preserved: every existing user gets a personal account on migration; their forms move into it transparently.

## Non-Goals (v1)

- Multi-owner accounts or ownership transfer.
- Custom roles beyond Viewer / Editor.
- Per-form permissions (roles are account-wide).
- Editors inviting other members.
- Submission email notifications to editors (owner-only for v1).
- Audit logging of member actions (deferred to Phase 4 audit logging work).

## Account Model

**Hybrid:** every user always has their own personal account (one-to-one with the user). Each user can additionally be a member of any number of other accounts they were invited to. Each account has exactly one owner; ownership is permanent.

A **Form belongs to exactly one Account.** Forms are scoped to accounts, not directly to users. The user who originally created a form is preserved as `Form.userId` (createdBy), but ownership and access are determined by the form's `accountId`.

## Permissions Matrix

| Action | Viewer | Editor | Owner |
|---|---|---|---|
| View forms list | ✓ | ✓ | ✓ |
| Open form in builder | ✓ (read-only) | ✓ | ✓ |
| Create new form | ✗ | ✓ | ✓ |
| Edit form (schema, settings, slug, publish) | ✗ | ✓ | ✓ |
| Delete form | ✗ | ✗ | ✓ |
| View submissions | ✓ | ✓ | ✓ |
| Export submissions (CSV) | ✓ | ✓ | ✓ |
| Delete submissions | ✗ | ✗ | ✓ |
| View/change billing & plan | ✗ | ✗ | ✓ |
| Invite/remove members | ✗ | ✗ | ✓ |
| Stripe Connect (payments) | ✗ | ✗ | ✓ |

## Plan Limits

| Plan | Max members (excluding owner) |
|---|---|
| FREE | 1 |
| PRO | 5 |
| BUSINESS | Unlimited |

- The active member count *plus* pending (unaccepted, non-expired) invites must be `< plan_limit` when sending a new invite.
- Plan downgrade below the current member count: existing members keep access; new invites are blocked until member count drops below the new limit. (Soft enforcement, mirroring the existing over-quota form behavior.)
- Form creation by an editor counts against the **owner's** plan limits (`maxForms`, `maxSubmissionsPerMonth`, `maxStorageMB`).
- Stripe Connect for payment fields uses the **owner's** `StripeConnect` record. Editors can add Payment fields only when the owner has Connect enabled.

Add `maxMembers: number` to `PlanLimits` in `src/lib/plans.ts`.

## Data Model

Three new tables. `Subscription` and `StripeConnect` remain attached to `User` (the owner).

```prisma
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

enum MemberRole { VIEWER EDITOR }
```

`Form` gets a new column:

```prisma
model Form {
  // ...existing fields...
  accountId String
  account   Account @relation(fields: [accountId], references: [id], onDelete: Cascade)

  @@index([accountId])
}
```

`Form.userId` is retained (becomes "createdBy"). Existing `@@index([userId])` and `userId` field stay. Default account name is `"<Owner name>'s account"` (or `"<email>'s account"` if no name set), owner-editable.

### Migration plan

1. Add nullable `Form.accountId`.
2. Create `Account` table; insert one row per existing `User` with `ownerId = user.id`, `name = (user.name ?? user.email) + "'s account"`.
3. Backfill `Form.accountId` from `Form.userId → Account.ownerId`.
4. Set `Form.accountId` NOT NULL.
5. Create `AccountMember` and `Invite` tables.

The migration runs as a single Prisma migration with raw SQL for the backfill step.

## Access Control

Single helper resolves a user's role within an account; called from every API route and server component touching forms/submissions/members.

```ts
// src/lib/access.ts
export type Role = "OWNER" | "EDITOR" | "VIEWER";

export type Action =
  | "VIEW_FORM" | "CREATE_FORM" | "EDIT_FORM" | "DELETE_FORM"
  | "VIEW_SUBMISSIONS" | "EXPORT_SUBMISSIONS" | "DELETE_SUBMISSIONS"
  | "MANAGE_BILLING" | "MANAGE_MEMBERS";

export async function getAccountAccess(
  userId: string,
  accountId: string
): Promise<Role | null>;

export function can(role: Role | null, action: Action): boolean;

// Convenience for "give me the account this form lives in and the role I have there"
export async function getFormAccess(
  userId: string,
  formId: string
): Promise<{ form: Form; role: Role } | null>;
```

**API route changes:** every `/api/forms/*` and `/api/submissions/*` route currently filters by `userId: session.user.id`. They change to:

1. Resolve the form's `accountId` (or accept `accountId` for list/create routes).
2. Call `getAccountAccess(userId, accountId)`.
3. Reject with 403 if `can(role, action)` is false.
4. Read/write through `accountId`.

**Active account resolution:** the dashboard reads a `stelld_account` cookie set by the account switcher. The cookie holds the active account id; if missing or pointing to an account the user no longer has access to, falls back to the user's personal account. List endpoints (`GET /api/forms`) accept an `accountId` query param; the dashboard server component passes the active account id from the cookie.

## Invite Flow

### Sending (owner only, `POST /api/invites`)

1. Validate caller is owner of the target account.
2. Lowercase the email; reject if it equals the owner's email.
3. Reject if email is already a member of this account.
4. Reject if a pending (non-expired, non-accepted) invite already exists for this email — UI offers "Resend" instead.
5. Reject if `member_count + pending_invite_count >= plan.maxMembers` with `MEMBER_LIMIT_REACHED`.
6. Generate token: `crypto.randomBytes(32).toString("base64url")`. Store as-is (single-use, scoped to email + account; no hashing needed).
7. Set `expiresAt = now() + 7 days`.
8. Send Resend email with link `https://stelld.ca/invite/<token>` (bilingual EN+FR, matching the existing email pattern).

### Accepting (`/[locale]/invite/[token]`)

Public route. Server component:

1. Look up invite by token. If missing / expired / already accepted → friendly error page.
2. Render the invite landing page: "You've been invited to join *Account Name* as *Role*."
3. **Logged in?** Show "Accept" button → `POST /api/invites/[token]/accept`.
4. **Not logged in?** Show "I have an account → log in" and "Create account." Both paths preserve the token through a `?invite=<token>` query param threaded through the auth flows. The post-auth redirect lands back on `/invite/<token>` to complete acceptance with one click.
5. **Email mismatch on accept:** if the logged-in user's email doesn't match the invite's email, show "This invite was sent to *email* — please log in with that email." Block acceptance.

### Acceptance transaction

Wrapped in `prisma.$transaction`:
1. Re-check token validity (not expired, not accepted).
2. Re-check email match.
3. Re-check membership doesn't already exist (idempotent on duplicate clicks).
4. Insert `AccountMember`.
5. Set `Invite.acceptedAt = now()`.
6. Set the `stelld_account` cookie to the new account id and redirect to `/dashboard`.

### Member management

- **Resend invite:** owner clicks "Resend" → `POST /api/invites/[id]/resend` → if expired, generate fresh token; otherwise reuse the existing token. Send email.
- **Revoke invite:** `DELETE /api/invites/[id]` → deletes row.
- **Remove member:** `DELETE /api/members/[id]` (owner only, can't remove self) → deletes `AccountMember`. Forms they created stay attached to the account; `Form.userId` is preserved for history.
- **Change role:** `PATCH /api/members/[id]` with `{ role: "VIEWER" | "EDITOR" }`.
- **Leave account:** `DELETE /api/members/me?accountId=...` (member, can't leave own account).

## UI

### Account switcher (header on all dashboard pages)

- Dropdown trigger shows the active account's name with a chevron.
- Lists user's personal account first, then any other accounts they're a member of, with role badge ("Editor" / "Viewer").
- Selection sets the `stelld_account` cookie and reloads the dashboard.

### Forms list (`/dashboard`)

- Scoped to the active account.
- Viewers: no "+ New Form" button.
- Editors and Owners: "+ New Form" button visible.
- Each form shows a "Created by *name*" hint as secondary text.

### Form builder (`/builder/[id]`)

- **Viewers:** read-only mode. All inputs disabled, no autosave, no Save indicator. "Read-only" badge in the toolbar. Can preview.
- **Editors:** full builder. Delete button hidden.
- **Owners:** full builder including delete.

### Submissions (`/dashboard/forms/[id]`)

- Viewers + Editors: view + CSV export. No delete.
- Owners: full controls including delete.

### Settings → Members (new, `/dashboard/members`, owner-only)

- Top: editable "Account name" field.
- Members table: avatar, name, email, role (dropdown to switch Viewer ↔ Editor), Remove button.
- Pending invites table: email, role, sent date, expires, Resend / Revoke buttons.
- "+ Invite member" button → modal with email + role selector. Disabled with upgrade prompt at plan limit.

### Settings → Account (member view, on accounts they don't own)

- Account name (read-only), owner email, your role, "Leave account" button.

### Billing (`/dashboard/billing`)

- Owner-only. Non-owners redirect to `/dashboard` with a flash message.

### Permission UI hints

- Disabled controls (greyed out) with tooltip "View-only access" rather than hiding controls entirely. Keeps UI consistent and self-explanatory.

### i18n

- All new strings added under a new `members` namespace in `messages/en.json` and `messages/fr.json`.
- Invite emails support EN + FR bodies with the same divider pattern as existing notification emails.

## Error handling

- `MEMBER_LIMIT_REACHED` (403): UI shows upgrade prompt with current/max counts.
- `INVITE_DUPLICATE` (409): UI offers "Resend invite."
- Invite expired / invalid / already accepted: friendly error page on `/invite/[token]`.
- Email mismatch on accept: blocked with helpful message.
- `SELF_INVITE` (400): "You can't invite yourself."
- `ALREADY_MEMBER` (409): "Already a member."
- Plan downgrade below member count: members keep access; new invites blocked with upgrade prompt.
- Form creation at plan cap by editor: editor sees "Account is at form limit — owner must upgrade."

## Security

- Invite tokens are 32 bytes from `crypto.randomBytes`. Single-use, scoped to one email + account.
- Rate limit `POST /api/invites` to 10/hour per owner via existing `rate-limit.ts`.
- Rate limit `/invite/[token]` lookups to 20/hour per IP to prevent token enumeration.
- All access-control checks happen server-side. Client-side disables are UI hints only.
- Invite acceptance requires being logged in with the matching email — prevents link forwarding.
- Concurrency-safe acceptance via Prisma transaction.

## Testing (manual)

- Owner invites editor → editor signs up via link → editor creates form → owner sees the form in their list → form counts against owner's plan.
- Owner invites viewer → viewer logs in → forms list visible, builder loads read-only, "+ New Form" hidden, no delete buttons on submissions.
- Account switcher: user with personal account + 1 invited account sees both, can switch, sees correct forms scoped to each.
- Plan downgrade: owner at PRO with 4 members downgrades to FREE; existing 4 keep access; new invite blocked.
- Invite revoke: owner revokes pending invite; the email link shows "invalid/expired."
- Email mismatch: invite to one email, log in with another, click link — blocked.
- Idempotent acceptance: clicking the link twice quickly results in exactly one `AccountMember` row.
- Remove member: removed user no longer sees the account in their switcher; their previously-created forms remain in the account.
- Leave account (member): account disappears from their switcher; cannot leave own account.

## File-level Impact (anticipated)

**New:**
- `src/lib/access.ts`
- `src/app/api/invites/route.ts` (POST list/create), `src/app/api/invites/[id]/route.ts` (DELETE/PATCH for resend/revoke), `src/app/api/invites/[token]/accept/route.ts`
- `src/app/api/members/route.ts`, `src/app/api/members/[id]/route.ts`, `src/app/api/members/me/route.ts`
- `src/app/[locale]/invite/[token]/page.tsx`
- `src/app/[locale]/(dashboard)/dashboard/members/page.tsx`
- `src/components/account-switcher.tsx`
- `src/lib/email.ts` — new invite email template
- `prisma/migrations/<timestamp>_team_collaboration/`

**Modified:**
- `prisma/schema.prisma`
- `src/lib/plans.ts` (add `maxMembers`)
- `src/app/api/forms/route.ts`, `src/app/api/forms/[id]/route.ts`
- `src/app/api/submissions/*` routes
- All dashboard/builder server components that read `session.user.id` to filter — now resolve the active account and check role
- `messages/en.json`, `messages/fr.json` (new `members` namespace)
- Header layout (insert account switcher)
