# Tipig User Manual

> Kwarta, klaro.

Tipig is a private, single-user money tracker. This manual covers how to use every screen in the app.

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Overview](#2-overview)
3. [Transactions](#3-transactions)
4. [Accounts](#4-accounts)
5. [Savings Goals](#5-savings-goals)
6. [Annual Summary](#6-annual-summary)
7. [Settings](#7-settings)

---

## 1. Getting Started

Tipig has no public sign-up. Access is locked to a single, pre-approved identity:

- **Email** — must exactly match the one address configured for this deployment (`ALLOWED_EMAIL`). Any other email is rejected, even if it belongs to a valid Supabase user.
- **Secret Key** — a private passkey configured for this deployment (`SECRET_KEY`), entered into a masked password field. It is not a magic link and not a Google/OAuth sign-in — just email + passkey.

To log in:

1. Open the app. You'll land on `/login` if you're not already signed in.
2. Enter your email and secret key.
3. Submit. The button shows a loading state while the server verifies your credentials.

If either field doesn't match exactly, or if a session somehow authenticates as a *different* email than the allowed one, you'll be signed out automatically and redirected back to `/login?error=unauthorized`. This double-check happens on every request (not just at login), so there's no scenario where a second identity can ride along on a stale session.

**Keep your secret key somewhere safe** — a password manager, not a note in this repo. It's the only thing standing between the app and your financial data.

---

## 2. Overview

The Overview page (`/`) is the dashboard — your financial state at a glance for the selected month. Use the `‹` / `›` arrows to step between months.

### The KPI Triad

Three cards at the top summarize your entire financial position, not just the selected month:

| Card | Meaning |
|---|---|
| **Total Money** | Sum of the current balance across every active account (all accounts combined, digital and physical). |
| **Saved Money** | Sum of everything currently allocated across all your active Savings Goals. |
| **Available to Spend** | Total Money minus Saved Money — what's actually free to use right now. This is the highlighted card, since it's usually the number you actually care about day to day. |

Saved Money is not a separate pool of cash sitting somewhere special — it's still physically inside your accounts. The KPI triad exists specifically to show you how much of your Total Money is earmarked versus free.

### Cash Flow

The Cash Flow card shows figures scoped to the month you're viewing:

- **Income**, **Expenses**, **Savings** — totals for that month by transaction type.
- **Net Cash Flow** — Income minus Expenses minus Savings, colored green when positive and red when negative.
- A grouped bar chart breaking the month down into Income vs. Needs / Wants / Savings, so you can see at a glance how spending compares to your budget targets.

If a month still has unswept positive cash flow left over, a **Monthly Review** card appears letting you sweep it into Unallocated Savings or a specific goal (see [Monthly Sweep](#monthly-sweep) below). Ignoring it is fine — the leftover simply keeps counting as Available to Spend.

### Coins Quick Entry

A row of one-tap buttons for the small, repetitive Coin Pouch expenses that aren't worth filling out the full transaction form for — jeepney fare, snacks, photocopying, and similar. Each button is pre-configured with a category and a default amount; tapping it immediately logs an EXPENSE transaction against the Coin Pouch account. No form, no confirmation — it posts instantly.

---

## 3. Transactions

The Transactions page (`/transactions`) is the ledger — every financial movement lives here, filtered to one month at a time.

### Logging a Transaction

Use the **Add Transaction** form. The fields shown adapt to the transaction **Type**:

- **INCOME** — needs a category and destination account.
- **EXPENSE** — needs a category, a Needs/Wants classification, and a funding source. If you choose "Saved Money" as the funding source, you must also pick which savings goal the money is coming from (spending from savings reduces that goal's saved amount).
- **SAVINGS** — just an amount and account. The money is automatically split evenly across your active savings goals — see [Savings Goals](#5-savings-goals).
- **TRANSFER** — needs a destination account. Transfers between your own accounts never count as income or expense.

### The Hard Floor

An EXPENSE or SAVINGS is **blocked** if the amount is more than the selected account's current balance — no account, digital or physical, can be pushed negative by a logged transaction. The error names the account and shows how much is actually available. (Physical accounts have an additional, more specific check — see below.)

### Physical Adjustments — the rule

If the account for an INCOME or EXPENSE (or either side of a TRANSFER) is Paper Cash or the Coin Pouch, the form additionally requires a **denomination breakdown**. This is a hard rule, not a suggestion:

- **INCOME**: declare exactly which bills/coins you received — the total must match the income amount exactly, or the entry is blocked.
- **EXPENSE**: which bills/coins you handed over, and which you got back as change. The transaction is **blocked** if the exact denominations you're claiming to hand over aren't actually on hand — physical accounts can never go negative or "invent" a bill that doesn't exist in the ledger — and handed-over minus expense amount must exactly equal the change breakdown you enter.
- **TRANSFER** (breaking bills): both sides must total the transfer amount, and the source side is checked against on-hand quantities the same way as an EXPENSE.
- This validation runs *before* anything is written, so a rejected physical transaction never leaves a half-written or orphaned row behind.
- The submit button stays disabled until the breakdown you've entered actually adds up — you don't have to submit blind to find out it's wrong.

If your physical cash on hand ever drifts from what Tipig has recorded (bills you didn't log, a miscount, cash lost), don't try to force it through a normal transaction — use **Reconcile** from the Accounts page instead (see below).

### Search & Filter

The Search & Filter card lets you narrow the current month's list by:

- Free-text search over the description
- Transaction type (Income / Expense / Savings / Transfer)
- Budget bucket (Needs / Wants)
- Category
- Account (matches either the source or destination account)

Filters combine (AND), apply within the selected month, and persist in the URL so a filtered view is shareable/bookmarkable. Use **Clear** to reset back to the plain monthly list.

Tap any row to edit it; the trash icon deletes it.

---

## 4. Accounts

The Accounts page lists every account with its live, calculated balance — never a manually-entered number. Balances are always derived from the opening balance plus every transaction that touches that account.

Accounts fall into three practical groups:

- **Digital Banks** (`DIGITAL_BANK`, `TRADITIONAL_BANK`) — MariBank, GoTyme, LandBank, Wise, and similar. Ordinary bank balances with no denomination tracking.
- **E-Wallets** (`E_WALLET`) — Maya and similar. Treated the same as digital banks for balance purposes.
- **Physical Cash** (`PAPER_CASH`, `COIN_POUCH`) — Paper Cash and the Coin Pouch. These are the only accounts backed by a denomination-level ledger (a running count of how many of each bill/coin you're holding), which is what enforces the Physical Adjustment rule above.

Digital/e-wallet accounts and physical accounts are displayed in separate lists on the Overview page ("Account Locations") so you can see at a glance where money is sitting.

### Reconciling Physical Cash

Open **Reconcile** on a Paper Cash or Coin Pouch account to fix drift between what's recorded and what you actually counted:

1. Each denomination shows what's currently recorded.
2. Enter the actual count next to any row that's wrong — leave the rest untouched.
3. Submitting creates an explicit adjustment transaction: a shortfall logs a **Physical Adjustment/Loss** expense, extra cash found logs a **Physical Adjustment/Gain** income. Nothing is silently overwritten — every correction is a real, auditable ledger entry.

### Archiving

Accounts can be archived (not deleted) once no longer used — an archived account drops out of the active lists and transaction dropdowns but its history stays intact.

---

## 5. Savings Goals

The Savings page tracks progress toward specific purposes — Graduation Fund, Emergency Fund, Certification Fund, Investments, and any others you add — separately from *where* the money physically sits.

Each goal shows its name, target amount, current saved amount, remaining amount, and completion percentage.

### Automatic even-split

When you log a `SAVINGS` transaction, you don't pick a single goal — the amount is automatically divided evenly across every active goal (except the built-in **Unallocated Savings** catch-all). With 0 active goals the whole amount goes to Unallocated; with N active goals, each gets 1/N.

- If the division doesn't come out even (e.g. ₱100 across 3 goals = ₱33.33 each), each goal gets its floored share and the leftover centavos (₱0.01 in that example) go to Unallocated Savings, so the total always balances exactly.
- Editing a `SAVINGS` transaction's amount fully re-splits it from scratch against the current set of active goals — it doesn't just adjust the old split.
- Spending money **from** a goal (an EXPENSE with funding source "Saved Money") reduces that specific goal's saved amount directly, since that's a purpose being fulfilled, not a location changing.

Unallocated Savings can't be archived — it's the required destination whenever there are no other active goals, for the Monthly Sweep, and for any even-split remainder, so it always needs to exist.

### Monthly Sweep

At the end of a month, if there's positive cash flow left that hasn't been assigned anywhere, the Overview page prompts you to sweep it — pick a source account and a destination (Unallocated Savings or one specific goal), and it's logged as a SAVINGS transaction like any other. Unlike a normal SAVINGS entry, a sweep goes entirely to the one destination you pick, not split across goals. This step is a deliberate manual review, not automatic — nothing sweeps itself.

---

## 6. Annual Summary

The Annual Summary page (`/annual`) gives a full-year view. Use `‹` / `›` to change year.

- **Stat cards** — Annual Income, Annual Expenses, Annual Savings, and Net Cash Flow (Income − Expenses) for the whole year, each colored red/green based on sign where relevant.
- **Net Cash Flow chart** — a line graph of each month's net (income − expenses) across the year, so you can spot trends or one-off bad months at a glance.
- **Monthly Breakdown table** — one row per month with Income, Expenses, Savings, and Net columns, letting you compare months side by side without scrolling through the raw ledger.
- **Spending by Category** — every expense category for the year, sorted highest to lowest, showing where the money actually went.

All figures are computed directly from the transaction ledger for the selected year — there's no separate "report" data to get out of sync with your entries.

---

## 7. Settings

### Budget Targets

Set the percentage split of your budget across **Needs**, **Wants**, and **Savings** — the default is 30% / 10% / 60%, but it's fully configurable. The three fields must sum to exactly 100%; a live progress bar shows your current split and turns red if it doesn't add up, and the Save button stays disabled until it does. These targets are what the Overview page's Cash Flow chart compares your actual monthly spending against.

### Categories

Income and Expense categories are listed in their own cards. Each category can be edited (name, type, and — for expense categories — its default Needs/Wants classification), or archived via the trash icon.

**Category Archiving:** Deleting a category doesn't erase it — clicking the trash icon **archives** it instead (sets it inactive). This matters because past transactions still reference it; permanently deleting a category used by historical transactions would break the ledger. An archived category:

- Disappears from the active Income/Expense lists and from the category dropdown when logging new transactions.
- Is preserved on any transaction that already used it — your history and Annual Summary category breakdown stay accurate.
- Appears in a dedicated **Archived Categories** card at the bottom of the page, where a Restore button brings it back into active use at any time.

**Add Category** form: pick a Type first. The "Default Needs/Wants" field only appears when Type is Expense — Income categories have no such field at all, since Needs/Wants classification is meaningless for income. Switching Type back and forth shows/hides the field live, before you submit.

### Scholarship / Allowance Allocation

A small calculator, separate from the main ledger: enter a total amount, a starting month, and how many months it should cover, and Tipig divides the total evenly to show your monthly available allowance and the covered date range. It doesn't create any transactions — it's purely a planning aid.
