# Implementing the overhaul on the existing Tipig codebase

Ordered so the app compiles and runs after every step. Nothing here needs a
database migration: the design is a presentation change plus one calculation
module.

## Step 0: branch and dependencies

```bash
git checkout -b feat/bento-overhaul
npx shadcn@latest add sidebar dialog breadcrumb separator tooltip sheet skeleton
```

`components.json` points at the base-ui flavour of shadcn, so generated files
use `render={<button/>}` instead of `asChild`. Skim the generated
`src/components/ui/sidebar.tsx` once and note which of the two it emits: it is
the only thing `app-sidebar.tsx` depends on.

`npm run build` here, before writing any of your own code. If the sidebar
generator pulled in a component that clashes with `@base-ui/react`, you want to
know now and not five files later.

## Step 1: the shared surface tokens (do this first, it makes every later diff small)

The design uses exactly four surface values. Put them in `globals.css` as
semantic names rather than repeating `bg-zinc-900/30` in thirty places:

```css
.dark {
  /* existing vars stay */
  --surface-canvas: var(--color-zinc-950);
  --surface-card: color-mix(in oklch, var(--color-zinc-900) 30%, transparent);
  --surface-raised: var(--color-zinc-900);
  --surface-line: var(--color-zinc-800);
}
```

Then a card in the new design is `bg-(--surface-card) border border-(--surface-line)`.
Two reasons this matters: the light theme still exists in your `:root` block, and
`Card` currently uses `ring-1 ring-foreground/10` rather than a border, so hard
zinc classes on cards would fight the component. Set `--card` and `--border` to
the new values in `.dark` and most cards restyle themselves.

## Step 2: Phase 1, the calculation (no UI risk)

1. Add `src/lib/budget.ts`.
2. Add `src/components/budget-split-card.tsx`.
3. In `src/app/(app)/page.tsx` and `src/app/(app)/transactions/page.tsx`, delete
   the inline Budget Split `<Card>` and render:

   ```tsx
   <BudgetSplitCard
     totalMonthlyIncome={income}
     settings={settings}
     actuals={{ needs, wants, savings }}
   />
   ```

4. Delete `BudgetSplitStat` from `src/components/stat-cards.tsx` once neither
   page imports it.

Ship this on its own if you want: it is behaviour, and it is independent of the
shell work.

## Step 3: Phase 2, the shell

1. Add `src/components/app-sidebar.tsx`, `app-breadcrumbs.tsx`, `month-stepper.tsx`.
2. Replace `src/app/(app)/layout.tsx`.
3. Delete `src/components/nav-shell.tsx`. Nothing else imports it.
4. `theme-toggle.tsx` is now unmounted. Either drop it (the design is dark-only)
   or add it beside the avatar in the layout header.
5. Every page still renders its own `<h1>` and its own `‹ ›` month stepper. Now
   that the header owns both, delete them page by page:
   - `(app)/page.tsx`: the whole `flex items-center justify-between` header block.
   - `transactions/page.tsx`: same block.
   - `annual/page.tsx`: keep its year stepper (the header stepper is monthly),
     but drop the `<h1>` if you want the header breadcrumb to carry it. The
     design keeps a page-level title on Annual, so leaving it is fine.
   - `accounts`, `savings`, `settings`: drop the `<h1>`, keep everything else.
6. Every page currently wraps itself in `max-w-4xl mx-auto`, which the layout
   used to provide. Now the layout gives full width, so replace those wrappers
   with the per-screen container the design uses: `px-6 py-6` for the dense
   screens, `px-6 py-14` plus `max-w-3xl mx-auto` for the dashboard.

At the end of this step the app looks half-migrated: new shell, old pages. That
is expected and it works.

## Step 4: Phase 3, the dashboard

1. Add `src/components/quick-actions.tsx`.
2. Replace `src/app/(app)/page.tsx`.

What you are deleting from that page, and where it went:

| Removed from the dashboard | New home |
| --- | --- |
| Budget Split | `/analytics` |
| Cash Flow mini-stats + monthly bar chart | `/analytics` |
| Physical Cash Breakdown | `/analytics` (Denomination Breakdown tile) |
| Coins Quick Entry grid | Quick Coins dialog |
| Account Locations lists | `/accounts` (already lists them) |
| Monthly Review sweep form | see the note below |

The sweep form is the one piece with nowhere to go: it is an action, not a
visualization. Two options. Either give it a fourth action card on the dashboard,
shown only when `unswept > 0` (the dashboard already computes it for the closing
line, so it is a two-line change), or move the form into the Analytics
Budget Split tile as a footer. I would take the action card: sweeping is a
decision, and Analytics is for reading.

## Step 5: Phase 4, Analytics

1. Add `src/components/recent-ledger.tsx`.
2. Add `src/app/(app)/analytics/page.tsx`.

It imports the three existing chart loaders by relative path rather than
duplicating them:

```tsx
import { MonthlyBarChart } from "../monthly-bar-chart-loader"
import { DenominationBarChart } from "../denomination-bar-chart-loader"
import { NetCashFlowChart } from "../annual/net-cash-flow-chart-loader"
```

Two things to fix in the chart components themselves, because they were written
for a light card and now sit on `zinc-900/30`:

- `CartesianGrid` inherits a stroke that vanishes on the darker surface. Pass
  `stroke="var(--surface-line)"` explicitly.
- The Recharts default `aspect-auto h-64` fixed heights make the bento rows
  ragged. The design uses `h-64` for Net Cash Flow, `h-48` for the monthly bar,
  `h-36` per denomination chart.

The `/annual` page keeps using the same loaders unchanged, so verify that page
after this step: it is the easiest thing to break here.

## Step 6: the remaining five screens

These need no new logic at all: their Server Component bodies are already right,
they only need restyling to the bento vocabulary. Per screen, the actual work:

**Transactions.** Change the outer grid from `lg:grid-cols-[350px_1fr]` to
`[340px_minmax(0,1fr)]` (the `minmax(0,...)` is what lets the ledger table
scroll instead of stretching the page), make the Add Transaction card
`position: sticky top-20`, and swap the transaction list for a real `<table>`
inside `overflow-x-auto` with `min-w-[40rem]`. Move the Budget Split and the
Cash Flow card off this page entirely: they duplicate Analytics.

**Accounts.** `AccountGroup` currently renders rows inside one card. The design
makes each account its own card in a `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
Same data, same actions: move the `<Link>`/`ActionForm` pair from a row into a
card body. Keep the `opacity-0 group-hover:opacity-100` action reveal, it works
well at card scale too.

**Savings.** Keep `GoalCard` as-is and put the cards in a 2-column grid; promote
the Saved Money card to the hero treatment (`text-4xl font-light`). The
Unallocated goal keeps its `Auto` badge and stays first.

**Annual.** Already the closest to the design. Restyle `StatCard`, then give the
Monthly Breakdown and Spending by Category cards half the grid each instead of
stacking full-width. Highlight the current month's row with
`bg-zinc-900/60`. Add the inline bars to the category list: width is
`total / max * 100`, computed in the page, no new component.

**Settings.** Two columns: Budget Targets and Scholarship on the left, category
lists on the right. `BudgetRatiosForm` should show the live sum of the three
inputs and refuse to submit unless it is 100. That is the one real functional
addition on this screen, and it is where the Budget Split's ratio warning comes
from.

## Step 7: verification pass

```bash
npm run lint && npm run build
```

Then walk the app with these specific checks, because they are what this design
changes and therefore what it can break:

1. Collapse the sidebar and confirm every nav item still shows its tooltip.
2. Load `/transactions?month=2026-07&account=<uuid>&limit=15`, then click the
   header's next-month arrow. `MonthStepper` must preserve `account` and `limit`
   and only rewrite `month`.
3. Open Add Transaction from the dashboard, pick a physical account, submit an
   unbalanced denomination breakdown. The Hard Floor error must land as a toast
   inside the dialog, not blank the page: `ActionForm`/`useActionToast` already
   handle it, but the dialog is a new context for it.
4. Submit successfully from the dialog and confirm the page revalidates behind
   it (the action calls `revalidatePath("/", "layout")`) and the dialog closes.
5. Set your Settings targets to 30/10/50 and check Analytics shows the
   "do not add up to 100%" line rather than a short bar.
6. Log a month with zero income and confirm Budget Split renders empty with its
   explanatory copy instead of three coloured segments.
7. Narrow to 375px. The bento collapses to one column, and the ledger and
   Monthly Breakdown tables scroll inside their cards without widening the page.

## Suggested commit sequence

```
feat(budget): calculate split against total monthly income
feat(shell): native shadcn sidebar layout with breadcrumbs
feat(dashboard): action-oriented welcome hub with quick-action dialogs
feat(analytics): bento grid for charts and recent ledger
refactor(pages): restyle transactions, accounts, savings, annual, settings
chore: remove nav-shell and unused stat-card variants
```

## Step 8: Visual Fidelity Overrides (The Mockup Sync)

The UI must strictly mirror the provided reference mockups. Standard shadcn/ui defaults must be overridden with the following layout paradigms:

1.  **Overview Page (The Hero Layout):**
    *   Greeting must be horizontally centered.
    *   KPIs (Available / Saved) must sit in a 2-column grid, centered, using `text-5xl font-light tabular-nums`.
    *   Quick Actions must be a 3-column grid of border-only cards (`bg-transparent border-zinc-800 hover:bg-zinc-900/30`).
    *   The bottom summary must be a single inline flex banner with a dark fill.
2.  **Transactions Page (Split-Pane):**
    *   Must use `grid-cols-1 lg:grid-cols-[350px_1fr]`.
    *   Left pane: The "Add Transaction" form is rendered inline (NOT a dialog).
    *   Right pane: The ledger and filters.
3.  **Color & Border Enforcement:**
    *   Use `text-emerald-500` strictly for positive balances, income, and primary success actions.
    *   Use `text-red-500` for expenses.
    *   Remove default shadcn/ui card drop-shadows. Use flat borders (`border-zinc-800`) to create depth against the `bg-zinc-950` canvas.

## Phase 9: Savings Expenditure & Ledger Math Validation

Spending from savings requires strict isolation from monthly cash flow calculations. When a user spends saved money, it must not penalize their current month's "Available to Spend" or trigger budget-split overages. To solve this, we decouple the "Category" (what was bought) from the "Funding Source" (where the budget came from).

### 1. The Database Architecture (Funding Source)
We will not use categories for savings expenditures. Instead, we expand the `transactions` table structure to include:
*   `funding_source`: A text column or enum ('AVAILABLE' or 'SAVED'). Defaults to 'AVAILABLE'.
*   `savings_goal_id`: A UUID referencing the `savings_goals` table. Strictly required if `funding_source = 'SAVED'`.

### 2. The KPI Math Definitions (Global Balances)
To calculate global balances accurately, the backend data utilities must enforce these exact formulas:
*   **Total Money:** `SUM(All Income) - SUM(All Expenses)` (The physical reality of your accounts).
*   **Total Saved:** `SUM(All Savings) - SUM(Expenses WHERE funding_source = 'SAVED')`.
*   **Available to Spend:** `Total Money - Total Saved`. 
*(Because a savings expense reduces both Total Money AND Total Saved equally, the Available to Spend balance remains perfectly untouched).*

### 3. The Analytics View Definitions (Monthly Scope)
The Analytics page strictly evaluates the *current month's* on-budget performance. Saved money was earned and budgeted in the past, so spending it must remain "Off-Budget" for the current month.
*   **Monthly Expenses KPI:** Must append `WHERE funding_source = 'AVAILABLE'`.
*   **Budget Split (30/10/60):** The Actual Needs and Wants totals must exclude savings expenditures.
*   **Net Cash Flow:** Must only calculate `Monthly Income - Monthly Expenses (Available only)`. 

### 4. Savings Goals Synchronization
The specific progress of a Savings Goal is a derived state. 
`Goal Current Amount = SUM(Savings routed to Goal X) - SUM(Expenses WHERE savings_goal_id = Goal X)`. 
The Server Action handling transactions must ensure both the core ledger and the specific goal amounts are updated securely in tandem.

## Phase 10: Proactive Budgeting & Live Previews

To prevent users from accidentally over-committing their funds or unknowingly driving their "Available to Spend" balance negative, the Transaction Form must act as a proactive windshield rather than a reactive mirror. This is achieved entirely via client-side state derivations to protect performance.

### 1. Live Projected Balance (The Windshield)
The `<TransactionForm>` must accept the user's current `availableToSpend` as a prop. As the user types, the form calculates a `projectedBalance` in real-time based on three conditions:
*   **Condition A (Standard Expense):** `type === 'EXPENSE'` AND `funding_source === 'AVAILABLE'`. Math: `availableToSpend - inputAmount`.
*   **Condition B (Savings Commitment):** `type === 'SAVINGS'`. Math: `availableToSpend - inputAmount`. (Committing money removes it from the daily pool).
*   **Condition C (Saved Expense):** `type === 'EXPENSE'` AND `funding_source === 'SAVED'`. Math: `availableToSpend` remains unchanged. (Displays: "No impact on available balance").

### 2. Elevated Funding Source Toggle
The `funding_source` selection must not be hidden. It must be a prominent, segmented toggle (e.g., standard tabs or a distinct radio group) placed immediately above the Amount field. Switching this to "Saved Money" should visually alter the form's accent color (e.g., from Emerald to Blue) to explicitly signal that the user is now interacting with their off-budget savings vault.

### 3. Dynamic Submit Button (The Guardrail)
The system must not physically block digital overdrafts, but it must explicitly warn the user before submission.
*   **Safe State:** If `projectedBalance >= 0`, the submit button is a solid, vibrant Emerald reading "Add Transaction".
*   **Warning State:** If `projectedBalance < 0`, the submit button instantly turns into a destructive/warning variant (e.g., muted red or amber). The label must change to explicitly state the consequence: `Add Anyway (Available Balance will drop to ₱[projectedBalance])`.