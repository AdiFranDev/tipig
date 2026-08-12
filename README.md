# Tipig

> **Kwarta, klaro.**

**Version 2.0.0** — Tipig is a private, single-user personal finance tracker built as a strict **dual-ledger envelope budgeting system**. It replaces a Google Sheets money tracker with a faster, more accurate, mobile-friendly web application, fully owned and controlled by its one authorized user.

Tipig is not, and will not become, a public budgeting platform, a commercial financial service, or a multi-user SaaS product.

## What "Dual-Ledger Envelope Budgeting" Means

Tipig runs on two ledgers that are never allowed to drift out of sync with each other:

1. **The transaction ledger** (`transactions`) — the single source of truth for every peso that moves. Account balances, monthly/annual totals, and savings progress are all *derived* from it, never stored independently.
2. **The physical denomination ledger** (`transaction_denominations`) — a double-entry ledger tracking every individual ₱-bill and coin, kept separate because physical cash has a constraint digital money doesn't: it can't go negative, and the exact bill/coin on hand has to be provable, not just totaled.

On top of both ledgers sits **envelope budgeting**: money is tracked by *where it physically sits* (an Account — MariBank, Paper Cash, Coin Pouch, ...) completely independently of *what it's earmarked for* (a Savings Goal — Emergency Fund, Graduation Fund, ...). Spending from a goal reduces both simultaneously; nothing else does.

## What's New in 2.0.0

- **"Location vs. Purpose" Architecture** — strict separation between physical/digital accounts (where money sits) and savings goals (what money is for), enforced end-to-end from the schema up through every dashboard and form.
- **Proactive Budgeting** — the transaction form live-projects the resulting Available-to-Spend balance as you type, and softens (never blocks) a submission that would push it negative with an explicit "Add Anyway" confirmation.
- **Advanced Financial Analytics** — new Recharts visualizations on the Annual Summary page: a 12-month 30/10/60 Needs/Wants/Savings budget-split bar chart, a cumulative savings-vs-expenses wealth trajectory, and a Top 10 spending categories breakdown.
- **Pixel-Perfect Bento Box UI** — a complete dark-mode visual overhaul across Dashboard, Accounts, Savings, and Annual, with every quick action (Add Transaction, Quick Coins, Sweep) wired to a controlled-state modal for instant, reliable interaction.
- **Hardware-Optimized** — built Server Component-first: pages fetch and render on the server by default, and client-side JavaScript is limited to small, deliberate islands (forms, dialogs, charts). The result is a lean client footprint that stays comfortable to develop on even on modest hardware.

## Core Principles

### Keep It Simple

Tipig is a focused personal tool, not a platform. A feature is only built when it:

- Replaces part of the original spreadsheet
- Makes transaction entry faster
- Improves financial accuracy
- Reduces repetitive work
- Makes financial information easier to understand
- Solves a problem currently experienced by the owner

### One Financial Source of Truth

The centralized transaction ledger is the only place financial data originates. Account balances, monthly totals, annual totals, savings figures, and every dashboard metric are calculated from recorded transactions — never stored redundantly.

### Separate Location from Purpose

```text
Physical location:
MariBank balance = ₱10,000

Savings purposes:
Emergency Fund      = ₱4,000
Certification Fund  = ₱2,000
Graduation Fund     = ₱1,000
Unallocated Savings = ₱3,000
```

### Avoid Double Counting

Transfers between owned accounts are never income or expenses. Savings allocations are reported separately from ordinary spending, so a savings contribution never appears as consumed money.

### Privacy First

Only one pre-authorized email address can access the application. There is no public sign-up, no teams, and no multi-user support.

## Features

- **Transaction Ledger** — add, edit, delete, search, and filter by month, type, budget bucket, category, and account.
- **Accounts** — digital and physical accounts with dynamically derived balances; archive/restore, not delete.
- **Savings Goals** — purpose-based funds with target amounts, live progress bars, and automatic even-split allocation of new savings across active goals.
- **Physical Cash Hard Floor** — an exact bill/coin denomination ledger for Paper Cash and the Coin Pouch; a physical expense is blocked outright if the precise denominations aren't on hand.
- **Monthly Sweep** — leftover monthly cash flow is explicitly reviewed and swept into Unallocated Savings or a specific goal, never carried forward silently.
- **Budget Buckets** — Needs / Wants / Savings classification against a configurable target ratio (default 30/10/60).
- **Scholarship / Allowance Allocation** — divides a lump sum across its covered months into a simple monthly available amount.
- **Annual Summary** — monthly and annual income/expense/savings/net cash flow, plus the 2.0 analytics charts described above.
- **Import/Export (planned)** — CSV import from the legacy spreadsheet with duplicate detection and a preview step, and CSV export for personal backups.

## Technology Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL, Auth, Row Level Security) |
| Hosting | Vercel |

## Security

- Authentication is email + secret key via Supabase Auth, restricted to a single `ALLOWED_EMAIL` — no public sign-up, no OAuth, no magic links.
- Every table enforces Row Level Security scoped to `auth.uid() = user_id`; RLS is never disabled to work around a permissions error.
- The Supabase service-role key is never exposed to the browser, and `.env.local` is never committed.

## Getting Started

```bash
npm run dev     # start the dev server
npm run build   # production build
npm run start   # run the production build
npm run lint    # ESLint
```

Requires `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ALLOWED_EMAIL`, and `SECRET_KEY`. There is no test suite configured yet.

## Project Status

Tipig is under active development. The 1.0 groundwork — Next.js/Supabase setup, private authentication, accounts, categories, the transaction ledger, savings allocation, physical cash tracking, and monthly/annual dashboards — is in place. 2.0 builds proactive budgeting, advanced analytics, and the bento UI redesign on top of it.
