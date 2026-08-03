# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) or any AI assistant when working with code in this repository.

@.agents/rules/project-context.md

## Commands

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint (flat config, `eslint-config-next` core-web-vitals + typescript)

*There is no test suite configured yet.*

## Next.js Version Note

This project pins `next@16.2.12`. Treat this as potentially different from training-data Next.js knowledge — check `node_modules/next/dist/docs/` (App Router docs under `01-app/`) before relying on remembered conventions for routing, data fetching, caching, or config.

## Architecture & Authentication

**Stack:** Next.js App Router + TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + Auth), deployed to Vercel. Single-user app — auth is strictly locked to one email.

**Auth Flow:** (Supabase Auth via email + secret key, restricted to one address — no Google OAuth, no magic link)
- `src/proxy.ts` (Next.js 16 renamed `middleware.ts` to `proxy.ts`) delegates to `src/lib/supabase/middleware.ts` (`updateSession`), which runs on every request except static assets. It refreshes the Supabase session from cookies and enforces the single-user rule: if the authenticated user's email doesn't match `process.env.ALLOWED_EMAIL`, it signs them out and redirects to `/login?error=unauthorized`.
- `src/app/login/page.tsx` is a server component that renders `src/app/login/login-form.tsx`, a client component with an email input and a secret-key input (`type="password"`). Submitting calls the Server Action `login` in `src/app/login/actions.ts`, which compares the submitted email/key against `process.env.ALLOWED_EMAIL`/`process.env.SECRET_KEY` (server-side only, never sent to the client) and, on a match, calls `supabase.auth.signInWithPassword` (the Supabase user's password is the secret key — set directly on `auth.users` via SQL, not through a signup flow). A child component reads `useFormStatus()` to swap the form for a loading state while the action is pending.
- `src/lib/supabase/{client,server,middleware}.ts` are three distinct client constructors following `@supabase/ssr` patterns. Do not collapse them into one.
- Server Components that need auth independently call `supabase.auth.getUser()` and `redirect('/login')` as defense-in-depth on top of the middleware.

**Env Vars (`.env.local`, gitignored):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAIL`, `SECRET_KEY`.

## Product Model & Non-Negotiable Domain Rules

Tipig is a private, minimalist personal finance tracker replacing a spreadsheet. Read `.agents/rules/project-context.md` for the full spec.

1. **The Ledger is the Source of Truth:** The `transactions` table drives everything. Account balances, monthly/annual totals, and savings progress must be derived dynamically from it.
2. **Transaction Enums:** `type` is strictly one of `INCOME`, `EXPENSE`, `SAVINGS`, or `TRANSFER`. Transfers between owned accounts are never counted as income or expenses.
3. **Location vs. Purpose:** "Account" (physical/digital location, e.g., MariBank) is modeled separately from "Savings Goal" (intended purpose, e.g., Emergency Fund). Spending savings reduces both simultaneously.
4. **The Coin Pouch & Physical Cash (The "Hard Floor"):** 
   - Physical cash uses a double-entry denomination ledger (`transaction_denominations`). 
   - The ₱20 Bill (Paper Cash) and ₱20 Coin (Coin Pouch) are distinct.
   - **Hard Rule:** A physical expense must be blocked if the exact required coin/bill denominations are unavailable. Physical accounts cannot go negative.
5. **Monthly Sweep:** Remaining positive cash flow at the end of a month is explicitly reviewed and swept into `Unallocated Savings` or a specific goal. 
6. **Currency & Types:** Strictly PHP (₱). Strip all multi-currency UI bloat. Amounts must use exact numeric database types (`NUMERIC(12,2)`), never floating point.
7. **Security:** All Supabase tables use Row Level Security (RLS) scoped to `auth.uid() = user_id`. Never disable RLS, and never expose the service-role key client-side.
8. **Minimalism:** Do not add features outside the `.agents/rules/project-context.md` scope. Do not engineer SaaS multi-tenant logic.