# Source Archive — reconstructed context

**Written 2026-08-08.** The Claude Code sessions that built this project lived on a laptop that is no longer accessible; their transcripts are gone. This document reconstructs what those sessions produced by reading the git history, the schema, and the code. It is **inference from artifacts, not a record of the original conversations** — where something is a guess, it says so.

Provenance: 87 commits, 2026-04-21 → 2026-07-22, all authored from `yawcoker@Yaws-MacBook-Pro.local`. 30+ carry `Co-Authored-By: Claude`.

---

## 1. What the system is

A sourcing-agency operating system for apparel/product development. It tracks a product from initial client enquiry through sampling, factory quoting, production, and invoicing — and exposes slices of that pipeline to the outside parties involved.

Three distinct surfaces share one Next.js app:

| Surface | Routes | Who uses it | Auth |
|---|---|---|---|
| **Agency backend** | `app/(app)/*` | Source Archive staff | Clerk (protected) |
| **Brand dashboard** | `app/(brand)/app/[workspace]/*` | Brand customers | Clerk + workspace membership |
| **Public portals** | `app/portal/*`, `app/factory/[token]`, `app/brief`, `app/enquire`, `app/techpack` | Clients, factories, leads | None — token/ID in URL |

The public portals are the interesting part: clients approve samples and pay invoices without an account, and factories submit RFQ quotes through a bilingual (CN/EN) token-gated page.

Stack: Next.js 16 (App Router) · React 19 · Supabase (Postgres + RLS + storage) · Clerk auth · Stripe · Tailwind 4 · Anthropic SDK.

---

## 2. Architecture

### Route groups

```
app/
├── (app)/          agency backend — clients, projects(collections), products,
│                   factories, leads, references, techpacks, studio, costs,
│                   tasks, dashboard, settings
├── (brand)/app/[workspace]/
│                   brand-facing SaaS — collections with five view modes
│                   (dashboard · table · kanban · timeline · costing),
│                   products, suppliers, activity
├── (marketing)/for-brands/
│                   public marketing — pricing, how-it-works, about
├── portal/[clientId]      client portal (public)
├── factory/[token]        factory RFQ portal (public, CN/EN)
├── brief · enquire · techpack   public intake forms
├── onboarding · onboarding-agency
└── api/
    ├── projects/[id]/production-invoice   xlsx/PDF generation
    └── webhook/stripe
```

`proxy.ts` (Next.js 16's replacement for `middleware.ts` — the old file was explicitly removed in a 2026-05-26 commit) runs `clerkMiddleware` and protects everything except the public routes listed above.

### The `lib/` layer

Data access is split by tenant boundary, which is the key thing to understand before editing:

- `supabase-agency.ts` — agency-scoped client. Mints a Clerk JWT via the `"supabase"` template so Postgres RLS sees the user; cached per-request with React `cache()`. Also exports `getAgencyServiceSupabase()`, a service-role escape hatch documented for exactly three uses: public portal, webhooks, admin scripts.
- `supabase-brand.ts` — brand-workspace client.
- `portal-data.ts` — the unauthenticated portal's read path (added 2026-07-20 when RLS broke it).
- `mode-policy.ts` — the permission matrix (see below).
- `plan-limits.ts` — plan → limits config for the SaaS tier.
- `brand-*.ts` — feature modules: catalog, costing, sampling, suppliers, planning, comments, activity.

### `mode-policy.ts` is the file to read first

It is the single source of truth for authorization in the brand dashboard: a matrix of `(action, workspace_mode) → allowed roles`, with a `can()` function every permission check routes through. Two workspace modes:

- **`managed`** — Source Archive runs the brand's sourcing. `sa_admin`/`sa_team` roles are members; supplier management and cost quoting belong to SA; billing is disabled (managed brands don't pay through the app).
- **`independent`** — the brand self-serves. Only `brand_owner`/`brand_member` exist; billing is enabled; suppliers are theirs to manage.

Its header comment is explicit: *never* add ad-hoc `if (workspace.mode === 'managed')` checks in components — extend the matrix. That comment is the clearest surviving statement of design intent in the codebase, and it tells you the architecture was deliberately built so the agency could later flip to SaaS-only.

---

## 3. Data model evolution

Base schema lives in `supabase-schema.sql` / `supabase-auth.sql` (agency-era). Numbered migrations track the brand-dashboard and multi-tenancy work:

| Migration | Adds |
|---|---|
| `001_brand_dashboard_foundation` | `workspaces`, `workspace_members`, `workspace_invites`, `subscriptions` + RLS |
| `002_collections_and_products` | brand-side catalog |
| `003_sampling_kanban_suppliers` | sample rounds, kanban stages, suppliers |
| `004_costing` | costing tables + multi-currency |
| `005_milestones` | planning/timeline |
| `006_comments_and_activity` | comments + activity feed |
| `007_agency_multitenancy_foundation` | `agencies`, `agency_members`, `agency_invites`, `is_agency_member()` helper, self-service create-agency RPC, backfill of the existing `ag-source-archive` row |
| `008_agency_multitenancy_retrofit` | `agency_id` + RLS policies across existing tables |
| `009_drop_legacy_allow_all` | **security fix** — see below |
| `010_studio_agency_id` | retrofit the three Studio tables missed by 008 |

All migrations are written idempotently ("SAFE TO RE-RUN") with `IF NOT EXISTS` / `DROP POLICY IF EXISTS` guards.

**Migration 009 is worth reading in full.** A pre-multi-tenant migration had left an `allow_all` policy (qual = `true`) on every table. Postgres combines RLS policies with `OR`, so `allow_all` silently defeated every `agency_id` filter — any signed-in user could read every agency's data. The fix drops `allow_all` from *every* public table by cursor rather than an allowlist, with a comment explaining that an allowlist had already missed several tables. That is a real vulnerability, found and closed, and the reasoning is preserved in the migration header.

Migration 010's header records the cause of a second miss: `brand_expenses`, `brand_costing_products`, `brand_costing_items` are named as if they belong to the brand dashboard but are actually agency-scoped, so 008 skipped them.

---

## 4. Timeline — what each phase of work was solving

**Era 1 · Apr 21–25 — bootstrap and auth thrash.** Initial commit, then the agency CRUD (clients, collections, products, factories), mobile layout, P&L and BOM modals. Auth was rebuilt three times in three days: Supabase auth → redirect-loop fixes → cookie/browser-client fixes → **migrated to Clerk on Apr 24**. Two commits in that window (`Temp: log Supabase URL on login attempt`, `Improve login error handling`) are visibly debugging-in-production.

**Era 2 · Apr 27–May 2 — the intake funnel.** Leads, client brief portal, reference samples, enquiry form, tech-pack intake, Techpacks workspace, file uploads, shareable form URLs. Then the Command Centre dashboard, multi-round sampling, cost tracker, Studio tab. This is where the product stopped being a CRM and became a pipeline.

**Era 3 · May 26–31 — the factory side.** Bilingual CN/EN factory RFQ portal with per-product quoting, photo upload, and assign-to-product flow. Deprecated `middleware.ts` removed for Next.js 16. Portal analytics per client.

**Era 4 · Jun 2–16 — the commercial engine.** Volume pricing tiers (client-facing *and* internal/supplier), price suggestor, Production P&L view, auto-tagging products via the Anthropic SDK (images + text + tech-pack PDFs), factory production invoices as `.xlsx` and then real PDFs via jsPDF, exclude-from-production flags, price history, soft-delete for cost entries. Several commits here are bug-fix pairs — the PDF work took four commits across one day.

**Era 5 · Jun 30–Jul 8 — getting paid.** Canonical `NEXT_PUBLIC_APP_URL` for shared links, Stripe Checkout from the client portal, a P&L semantics fix (`quoted_cost_usd` is the client sell price, not supplier cost — that one changed the meaning of a column), deposit → balance invoice workflow.

**Era 6 · Jul 10 — the pivot.** Brand dashboard Phases 1–4 in a single day: foundation + RLS + mode policy, collections/products with gallery and table views, sampling kanban and suppliers, costing with multi-currency rollups. This is where a single-tenant agency tool became a multi-tenant SaaS product with a marketing site and pricing tiers.

**Era 7 · Jul 20–22 — multi-tenancy, unfinished.** The agency backend itself became multi-tenant (agencies, members, invites, RLS everywhere), and then two consecutive commits fixing what that broke.

---

## 5. What was in flight when the laptop stopped

The last three commits tell a clear story:

1. `Multi-tenant agency backend` (Jul 20) — 39+ files, the retrofit itself.
2. `Fix portal reads/writes broken by RLS retrofit` (Jul 20) — the public portal has no Clerk session, so RLS locked it out. Fixed by routing portal access through `lib/portal-data.ts` and new server actions.
3. `Fix all client-component mutations broken by RLS retrofit` (Jul 22) — 15 files. Client components had been writing to Supabase directly with the browser client; under RLS those writes now fail. The fix pattern is consistent: **add an `actions.ts` next to each client component and move the mutation into a server action** (`clients/`, `costs/`, `factories/`, `products/[id]/`, `projects/[id]/`, `tasks/` all gained one).

### Audit result (2026-08-08): the table-mutation sweep was complete

All 52 `"use client"` files were checked for direct Supabase table writes. **There are none.** The only `.delete(` hits are JavaScript `Set.delete()` in selection handlers ([QuoteBuilder.tsx:117](app/(app)/projects/[id]/QuoteBuilder.tsx#L117), [ProjectsPageClient.tsx:347](app/(app)/projects/[id]/ProjectsPageClient.tsx#L347), [FactoriesPageClient.tsx:82](app/(app)/factories/FactoriesPageClient.tsx#L82)). Only four client components import the browser client at all, and none touches a table.

The `lib/` layer is equally clean — every data module routes through the correct authenticated client:

| Modules | Client |
|---|---|
| `data.ts`, `agency-data.ts` | `getAgencySupabase()` (Clerk JWT) |
| `brand-*.ts` (7 modules) | `getBrandSupabase()` |
| `portal-data.ts` | `getAgencyServiceSupabase()` — deliberate, the portal has no session |

So the Jul 22 commit finished what it started. Three real issues remain, none of them the one the commit messages imply:

**1. Storage uploads were never part of the retrofit — status unknown.** Uploads still run through the browser client against three buckets (`product-media`, `brand-receipts`, `rfq-assets`), from [lib/storage.ts](lib/storage.ts) plus two direct call sites ([StudioClient.tsx:171](app/(app)/studio/StudioClient.tsx#L171), [FactoryPortalClient.tsx:42](app/factory/[token]/FactoryPortalClient.tsx#L42)). Migrations 007–010 only altered tables in the `public` schema; `storage.objects` has its own policies, and **no storage policy exists anywhere in this repo** — they live only in the Supabase dashboard. Whether uploads still work therefore cannot be determined from the code. Test each bucket first; this is the one live risk.

**2. `lib/supabase-data.ts` is dead and dangerous.** It exports `supabaseData`, a plain anon-key client, and is imported by nothing. Its comment claims it is "safe to use server-side" — that was true pre-RLS and is now misleading: it carries no auth context, so any future import silently bypasses the `is_agency_member()` design. Delete it.

**3. The pre-Clerk auth pages are still in the tree.** [login/](app/(auth)/login/) and [signup/](app/(auth)/signup/) still call `supabase.auth.signInWithPassword()` / `signUp()`, left over from before the Apr 24 Clerk migration. They are unreachable: `proxy.ts` lists `/sign-in` and `/sign-up` as public but not `/login` or `/signup`, so Clerk's `auth.protect()` redirects any signed-out visitor away — and nothing in the app links to them except each other. Dead code holding a live auth surface. Delete both, and `lib/supabase.ts` with them once the storage question in (1) is resolved.

---

## 6. Running it on this machine

The clone is at `~/Projects/source-archive`, up to date with `origin/main`, one local change (`.gitignore` gained `/.clerk/`). `npm install` has been run; Clerk is in keyless dev mode (`.clerk/.tmp/keyless.json`).

**There is no `.env.local`, and that is the only thing blocking a real run.** Required:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_APP_URL
ANTHROPIC_API_KEY          # auto-tagging + Studio vision
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_BILLING_DEV_BYPASS   # optional, skips plan gating in dev
SEED_USER_ID                     # scripts/seed-brand.mjs only
```

**The data survived the laptop.** Supabase, Stripe, and Clerk are cloud accounts tied to you, not to that machine — the database, the schema, and every row are intact. Pull the keys from each dashboard and the app comes back up. Clerk additionally needs its `"supabase"` JWT template configured, or `getAgencySupabase()` mints no token and every RLS-protected read returns empty.

### One caveat if you touch the Anthropic calls

Two model IDs are hardcoded:

- `app/(app)/products/[id]/actions.ts:116` → `claude-haiku-4-5-20251001` — still current, no change needed.
- `app/(app)/studio/actions.ts:29` → `claude-opus-4-5` — still served, but superseded by `claude-opus-5`.

Neither call site sets `temperature` or `budget_tokens`, so a swap to `claude-opus-5` is a one-line change. **But** that Studio call sets `max_tokens: 512`, and on Opus 5 thinking is on by default and counts against `max_tokens` — a naive swap would truncate the response. Raise `max_tokens`, or pass `thinking: {type: "disabled"}` (valid at effort `high` or below).

---

## 7. What this document can't tell you

These are genuinely lost with the sessions, and only you know them:

- **Why managed vs independent mode exists as a product decision** — the code shows the mechanism, not the commercial reasoning.
- **Whether the Jul 22 RLS fix was believed complete**, or whether you knew there was more.
- **Whether "Kora" is part of this project at all.** It appears nowhere in this repo — not in code, commits, or history.
- **What was uncommitted** in the working tree on 2026-07-22.
