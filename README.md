# Tipig

> **Kwarta, klaro.**

Tipig is a private, minimalist personal finance tracker built for a single user, me. It replaces my existing Google Sheets money tracker with a faster, cleaner, more accurate, and mobile-friendly web application.

Tipig is designed around my personal financial workflow involving multiple digital accounts, exact paper cash and coin tracking, a 30/10/60 budgeting strategy, purpose-based savings funds, scholarship income, and monthly financial reviews.

The application is not intended to become a public budgeting platform, commercial financial service, or multi-user SaaS product.

## Project Status

Tipig is currently under active development.

The project is being developed incrementally, starting with:

1. Next.js application setup
2. Supabase connection
3. Private Google authentication
4. Accounts and categories
5. Centralized transaction ledger
6. Savings allocation
7. Physical cash tracking
8. Monthly and annual dashboards

## Why Tipig Exists

The existing Google Sheets tracker contains the necessary financial information and calculations, but it is inefficient for:

- Frequent transaction entry
- Mobile usage
- Filtering and searching
- Account balance monitoring
- Exact cash and coin tracking
- Savings fund allocation
- Monthly and annual financial review

Commercial budgeting applications provide better interfaces, but many useful features are restricted behind paid subscriptions. They may also fail to support the specific financial workflow used by the owner.

Tipig addresses this by converting the existing spreadsheet system into a private web application that is fully controlled by the owner.

## Core Objectives

Tipig should make it easier to:

- Record income, expenses, savings, and transfers
- Monitor balances across digital and physical accounts
- Separate Needs and Wants expenses
- Follow a 30/10/60 monthly allocation target
- Track exact paper bill and coin denominations
- Allocate saved money to specific financial goals
- Use saved money intentionally and transparently
- Review monthly and annual financial performance
- Understand how much money is owned, saved, and available to spend
- Back up financial records without paying a subscription

## Core Principles

### Keep It Simple

Tipig is a focused personal tool.

A feature should only be added when it:

- Replaces part of the existing spreadsheet
- Makes transaction entry faster
- Improves financial accuracy
- Reduces repetitive work
- Makes financial information easier to understand
- Solves a problem currently experienced by the owner

If a feature does not satisfy one of these conditions, it should not be built yet.

### One Financial Source of Truth

The centralized transaction ledger is the primary source of financial data.

Account balances, monthly totals, annual totals, savings figures, and dashboard metrics should be calculated from recorded transactions whenever practical.

### Separate Location from Purpose

Tipig distinguishes between:

1. Where money is physically or digitally stored
2. What the money is intended for

For example:

```text
Physical location:
MariBank balance = ₱10,000

Savings purposes:
Emergency Fund = ₱4,000
Certification Fund = ₱2,000
Graduation Fund = ₱1,000
Unallocated Savings = ₱3,000