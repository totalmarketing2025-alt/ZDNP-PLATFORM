# Phase 11 — PostgreSQL integration foundation

The migration creates persistent credentials, sessions and audit tables with RLS enabled and forced, and **no direct application role privileges**. The read-only repository uses transaction-local tenant identity and existing RLS to list authorized cases. CI runs PostgreSQL 16 security checks.

This is **not yet a fully operational login-to-PostgreSQL system**. The Phase 10 local JSON login is separate. Before connecting it to persistent credentials, implement an isolated trusted authentication service with safe password verification, login throttling, CSRF defense, HTTPS secure cookies, revocable sessions, account-change transactions, verified role resolution, and audited access. Never expose the DB or unreviewed admin functions to the browser. The role constraints in migration 001 do not yet include archivist; a reviewed schema change is required.

No real data, passwords, or institutional accounts are seeded. No changes to main or public website.
