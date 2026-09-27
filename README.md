# SINA Admin (Operations & Management Portal)

Progressive Web App (PWA) built with pure HTML5, CSS3, and JavaScript for business owners and operations managers to supervise field procurement and sales agents.

## Features
- **Field Cash Float & Reconciliation:**
  - Morning float issuance tracking per representative
  - Real-time ledger: `Disbursed Float + Cash Collected - Expenses = Net Cash in Hand`
- **Dual-View Filter:**
  - Consolidated view of all representatives vs. individual representative filter
- **Live Representative Tracking (`rep-detail.html`):**
  - Live activity feed showing what a particular representative is doing in the field
  - Timeline of shops visited, orders placed, receipts, and field expenses
- **User & Password Management (`representatives.html`):**
  - Create new field representatives
  - Update and reset representative passwords directly from the admin panel
  - Activate or deactivate representative accounts
- **Payment Verification & Approvals (`approvals.html`):**
  - Verify UPI transaction UTRs
  - Audit multi-image passbook / cheque uploads with high-res image inspector
- **Commodities & Catalog Master (`catalog.html`):**
  - Manage product categories and items
  - Configure rates for units: **Per kg**, **Per piece**, **Per bag**
- **Instant Refresh & Live Sync:**
  - Instant manual Refresh button with animated spin
  - Real-time BroadcastChannel alerts with floating toast notifications

## Tech Stack
- Vanilla HTML5, CSS3, JavaScript (ES6)
- Supabase PostgreSQL Client & Realtime
- Web App Manifest & Service Worker

## Repository
`https://github.com/dominaltech/sina_admin`
